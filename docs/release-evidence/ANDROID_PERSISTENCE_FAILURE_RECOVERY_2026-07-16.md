# Android persistence failure and recovery - 16 July 2026

## Verdict

The production Android Folio state path now reports failed encrypted-state writes instead of
silently swallowing them. The last complete staged generation remains intact, the app retries with
bounded backoff while it stays open, a user can request an immediate retry, and leaving the app
flushes pending work before the background transition completes.

This is partial evidence for T132 and `RB-VAULT-REAL-DATA-E2E`. It proves failure visibility,
kernel `ENOSPC` retry, encrypted PDF-source recovery, clean-sandbox portable restore, interrupted
Personal pre-partition migration, and—on the final release build—SQLCipher-first lossless state and
workspace-root authority. All 44 durable AppState fields now mirror atomically into schema-v8
canonical SQL, adopt generation-bound reads only after inverse parity, and commit privacy-minimal
typed-command receipts for mapped shipping mutations. This does not close the full import/restore
release-device matrix, kill-during-import, real-format endurance, cloud zero-knowledge restore or
iOS; those are validation and external boundaries, not unimplemented durable-field normalization.

## Implementation

- `apps/mobile/src/folio/lib/persistenceRuntime.ts` exposes an in-memory persistence state for the
  active workspace: idle, saving, saved or failed; attempt/save timestamps; failure class; and
  consecutive failure count.
- `apps/mobile/src/folio/lib/persist.ts` keeps encrypted writes serialized, retains the previous
  complete staged generation on failure, retries after 5, 15, 30 and then 60 seconds, flushes on
  backgrounding, exposes an immediate retry controller, and can quiesce the live writer across an
  explicit multi-store clear so its reset notification cannot race the direct SQL commit.
- `apps/mobile/src/local/nativeWorkspaceStateStore.ts` stores three hash-verified generations of
  the exact workspace partition and Personal root inside each opaque SQLCipher database. SQL reads
  happen before authenticated file fallback; state and root must exact-readback before a commit is
  accepted.
- `apps/mobile/modules/folio-local-vault` performs Android corrupt-family quarantine without
  reopening the broken database. It validates the opaque filename, copies and SHA-256 verifies all
  live family members before deleting any, and keeps the parked bytes until explicit local clear.
- `apps/mobile/src/folio/shell/FolioShell.tsx` renders a persistent accessible alert whenever the
  latest state has not been saved. The warning cannot be dismissed while the state remains failed.
- Storage exhaustion and quota-style errors are classified separately from device-key storage
  failures so the recovery copy can stay specific without exposing private values.

## Automated ENOSPC proof

`apps/mobile/src/folio/lib/persistRecovery.test.ts` injects an `ENOSPC` write failure after a
baseline encrypted generation has been saved. The test verifies that:

1. the previous ciphertext remains byte-for-byte unchanged after the failed newer write;
2. the runtime enters `failed` with the `storage` failure class and one consecutive failure;
3. an immediate retry succeeds after write access returns;
4. the runtime returns to `saved`; and
5. a cold load restores the newer value from the newly committed encrypted generation.

The complete focused persistence-recovery suite passes with 47 tests. It now also proves that an
unreadable orphaned temporary or backup generation is never misclassified as first run, a complete
temporary generation wins when main and backup are corrupt, a healthy main repairs a corrupt
backup, an interrupted legacy migration self-heals, migration `ENOSPC` retains the legacy copy and
retries through the serialized writer, and corrupt manifests recover or rebuild safely. The matrix
now includes good-stage/good-backup ordering, corrupt-main plus corrupt-stage fallback, missing-main
orphan-stage parking, and all-corrupt preservation.

## Release-built emulator proof

Device: `emulator-5554`, release APK, package `com.folio.v2.greenfield`.

The app-private files directory was temporarily changed from mode `771` to `500`, then Quiet Mode
was switched on as a reversible state change. The write failed and the production UI immediately
showed `Changes aren't saved yet`, the intact-last-save explanation and an accessible `Try saving
again` control. Quiet Mode remained visibly on in memory while the warning was present.

After mode `771` was restored, the exact accessibility control bounds were used to request the
retry. The warning disappeared, Quiet Mode remained on, and a force-stop/cold launch restored
Quiet Mode as on. It was then switched back off, saved, force-stopped and launched again; the clean
state restored as off.

Evidence:

- `melo-android-save-failure-visible-2026-07-16.png` - production failure warning, immediate retry
  control and the unsaved in-memory setting on the coded Melo companion surface.
- UI Automator assertions recorded the failure control as `Try saving again`, the failed state as
  `Quiet Mode, on`, the post-retry absence of the warning, the cold-restored on state, and the final
  cold-restored off state.

This was a controlled write-denial exercise. It is not labelled as a genuine full-disk device run;
the automated integration test supplies the explicit `ENOSPC` branch evidence.

## Release-built corruption and backup proof

The upload-signed release APK was also exercised against a genuinely unreadable current
generation on `emulator-5554`:

1. A small, reversible money picture was entered through the real onboarding flow. It was test
   input, not a shipped fixture or sample-data path.
2. Quiet Mode was used to distinguish two valid encrypted generations: the verified backup held
   Quiet Mode on and the newer main generation held it off.
3. With the process force-stopped, the main ciphertext was truncated to exactly 24 bytes. The
   verified backup was not touched.
4. On launch, the app parked those exact unreadable 24 bytes as the workspace's
   `.state.v1.unreadable.json`, restored the previous verified backup, and showed the production
   `Restored from the last good save` notice.
5. The restored UI reported Quiet Mode on, proving that the backup generation—not the newer,
   corrupted off generation—was the source of the recovered state.

Evidence:

- `melo-android-corruption-backup-recovery-2026-07-16.png` shows the visible recovery notice and
  the recovered release-built state.
- App-private file inspection recorded a 4,120-byte verified backup and the exact 24-byte parked
  unreadable main generation before cleanup.

This closes the specific Android corrupted-main-to-verified-backup case. Automated coverage now
includes interrupted migration and the staged/main/backup corruption combinations described above;
release-build drills for every combination, import-kill, remaining physical low-storage boundaries,
real-format endurance and cross-platform restore cases remain open.

## Release-built airplane-mode, destructive and identity-wipe proof

The rebuilt upload-signed release APK completed a bounded real-UI daily loop on `emulator-5554`
with airplane mode on, Wi-Fi disabled and mobile data disabled. A direct ping failed with
`Network is unreachable` before the product write:

1. The real onboarding UI created a temporary Stability picture with a £1,100 balance, £3,620
   monthly income and the 25th as payday. No sample/fixture route was used.
2. Melo was force-stopped and cold-launched offline. Today restored the configured £1,000 Safe
   Zone and £3,620 income.
3. `OfflineShop` £12.34 was logged through the real `Log a spend` sheet while still offline.
4. A second offline cold launch retained the transaction and the updated weekly spend. Today,
   Review, Melo and More all opened offline.
5. Removing the transaction exposed the real 30-second Undo. Undo restored it, and a third offline
   cold launch retained the restored transaction.
6. The three-confirmation local clear ran while still offline. A final offline cold launch showed
   `Your first picture`; the temporary merchant, name, balance and income were absent.

This drill exposed a separate privacy defect: `resetToEmpty()` intentionally retained the
onboarding name and payday as preferences. Those are user data. The implementation now clears
both values (plus income), preserves only the anonymous `onboarding.done` flag, and updates the
three-step deletion copy to describe setup-detail removal. Store, clean-slate, local-deletion and
persistence tests pass as a focused 283-test set. Reopening onboarding after the release-built
offline clear showed only the neutral `A name, a nickname` placeholder.

Evidence:

- `melo-android-airplane-mode-write-cold-start-2026-07-16.png` - the airplane-mode status icon,
  configured real-UI money picture and persisted offline transaction after a cold start.
- `melo-android-local-clear-identity-wipe-2026-07-16.png` - the blank setup name field after the
  offline three-confirmation wipe and cold start.

This closes the bounded encrypted-state Android airplane-mode write/cold-start/remove/undo/clear
loop. SQLCipher authority is proven separately below; import endurance and cross-device restore
remain open.

## Release-built clean-sandbox export and restore proof

The final upload-signed APK completed a real Android export/restore round trip after its entire app
sandbox and device-bound keys were cleared:

1. The real onboarding and transaction UI created `Restore test`, a £1,100 starting balance,
   £3,620 monthly income, payday 25 and `RestoreShop` £45.67. No fixture route was used.
2. `Export my data` ran the production export engine and opened Android's share surface. The
   portable `melo-personal-export.json` was 2,982 bytes, schema 11, SHA-256
   `D54AF36662B1B0DF5AFDCC45B1988C100EDF82525EED93EEA05A81F8AD3670FE`.
3. `pm clear com.folio.v2.greenfield` removed the complete app sandbox and its protected keys. The
   portable user export remained in Downloads, and the next launch showed the blank
   `Your first picture` doorway with an empty name field.
4. `Restore from an export` opened the real Android DocumentsUI picker. The first confirmation
   summarized exactly one transaction, zero subscriptions, zero pots and the `Restore test`
   identity; the second confirmation required explicit replacement approval.
5. Restore reported `Your data is back.` Today showed the exact £1,000 safe zone, £3,620 income,
   £1,100 starting balance and £45.67 transaction. A force-stop/cold launch restored every value.
6. The new encrypted workspace file contained none of the known name, merchant or amount strings
   in plaintext. The three-gate clear then removed the temporary profile, and the portable export
   was deleted.

Evidence: `melo-android-clean-device-restore-2026-07-16.png`.

This proves same-device portable-export recovery into a genuinely new Android sandbox/keyset. It
does not prove cloud backup recovery, cross-device sync/replay, server zero-knowledge properties or
the iOS path.

## Release-built kernel ENOSPC write and import proof

The final Android work also exercised real kernel `ENOSPC` without starving Android's global input
and media services. A root-controlled 64 KiB `tmpfs` was mounted temporarily over only Melo's
app-private files directory, with the original app UID and SELinux label. The physical phone was
not involved.

### Encrypted state write

1. A persisted baseline (`Low storage`, £1,860 monthly income and £900 balance) survived a cold
   launch before injection.
2. The real `Log a spend` sheet staged `StorageShop` £9.99 while the constrained volume had 0 KiB
   free.
3. The atomic encrypted save received kernel `ENOSPC`; zero-byte temporary files did not replace a
   complete generation. The production UI showed `Changes aren't saved yet`, the storage-specific
   explanation and `Try again` while the new transaction stayed visible in memory.
4. Removing only the bounded filler restored 56 KiB. Tapping `Try again` removed the warning and
   committed a complete manifest/state generation. A force-stop/cold launch restored the exact
   transaction and baseline with no fatal marker.

Evidence:

- `melo-android-enospc-retry-2026-07-16.png` - genuine `ENOSPC`, intact-save explanation and retry.
- `melo-android-enospc-recovered-cold-start-2026-07-16.png` - recovered write after a cold launch.

### Encrypted statement source

1. With the same app-private volume at 0 KiB, selecting a real PDF through DocumentsUI failed while
   retaining its encrypted source copy.
2. The drill exposed a UX defect: the old alert leaked the Expo/Java `writeAsStringAsync` exception.
   `evidenceRetentionFailureCopy()` now maps storage, protected-key, empty-file, oversized-file and
   unknown failures to bounded user copy; unknown native details are never rendered.
3. The rebuilt final APK showed `Not enough storage`, told the user to free space and choose the
   file again, and explicitly said nothing was added. UI Automator confirmed that `ENOSPC`, Java
   and Expo implementation strings were absent.
4. After the volume was freed, selecting the same PDF succeeded. Melo retained a 1,178-byte opaque
   AES-256-GCM source and locally read five candidates; the review screen still stated that nothing
   counted until the user chose it.

Evidence:

- `melo-android-import-enospc-sanitized-2026-07-16.png` - final sanitized storage failure.
- `melo-android-import-enospc-recovered-2026-07-16.png` - the same import after space returned.

An initial whole-emulator fill attempt reached Android's global low-space reserve before the input
tap reached Melo; the filler was removed immediately and capacity/services recovered. It is not
counted as product proof. The isolated app-volume runs above are the claimed kernel `ENOSPC`
evidence.

## Release-built migration-interruption proof

The final dual-ABI upload-signed APK was exercised against an interrupted real app-start migration
on `emulator-5554`:

1. A valid schema-11 Personal legacy generation containing `Migration proof`, a £1,234 starting
   balance, £2,222 monthly income and one £12.34 transaction was placed in the package's historic
   state path. The values came from the real current store serializer in a temporary test harness;
   they were not shipped or added to a product fixture.
2. The scoped schema-v11 partition contained only a deliberately truncated 29-byte temporary
   generation. No manifest, scoped main or scoped backup existed. This models interruption before
   the staged generation becomes the committed partition.
3. The release app did not classify that saved-but-unreadable temporary file as a first run. It
   parked the exact 29 bytes, loaded the complete legacy generation, showed `Your local data was
recovered`, and committed a new authenticated workspace state plus manifest.
4. Exact readback succeeded before the complete legacy main/temporary/backup generations were
   removed. The new scoped main contained none of the known identity, balance or income strings in
   plaintext; the parked incomplete bytes remained byte-for-byte available for recovery.
5. A force-stop/cold launch read only the healed scoped partition, restored the same balance,
   income and transaction, created a verified backup, showed no recovery/save-failure warning and
   logged no fatal marker.

Evidence:

- `melo-android-migration-interruption-recovered-2026-07-16.png` - first release launch from the
  complete legacy generation, with the recovery notice and restored values.
- `melo-android-migration-interruption-healed-cold-start-2026-07-16.png` - cold launch from the
  healed encrypted schema-v11 partition with the one-time notice gone.

This closes the Personal legacy-file to authenticated schema-v11 partition interruption case. The
later SQLCipher drill closes the exact-state migration and whole-database recovery case, but not
normalized schema checkpoints, kill-during-import, every production loss combination or iOS.

## Release-built SQLCipher authority, whole-database recovery and clear proof

The final dual-ABI upload-signed APK was exercised on `emulator-5554` with values emitted by the
real current schema-v11 serializer: `SQLCipher proof`, a £1,234 balance, £2,222 monthly income and
one £12.34 transaction. These were temporary test inputs and never shipped as product data.

1. A clean release install loaded the legacy Personal generation, committed the exact partition
   and workspace root into Personal SQLCipher, and removed the plaintext migration source only
   after exact SQL readback.
2. Every authenticated state/manifest rollback file was deleted while the process was stopped.
   A cold launch still rendered the exact balance, income and transaction. The SQLCipher database
   header was `a0 27 33 77 …`, not `SQLite format 3`, and the known fixture marker was absent from
   the database family.
3. Backgrounding recreated valid rollback copies. The live 24,576-byte SQL database was then
   deliberately corrupted by zeroing its first 4 KiB; its SHA-256 became
   `57D1EB0B4374C8DA24C4EC868719FEBE1BA0BCDCACA7980AB77B07B42396C25F`.
4. The first implementation attempt exposed that Expo's public filesystem bridge cannot safely
   rename from Android's private databases directory. The final native bridge instead copied and
   SHA-256 verified the corrupt family before removing live bytes.
5. The final run parked the corrupt database with the exact SHA-256
   `57D1EB0B4374C8DA24C4EC868719FEBE1BA0BCDCACA7980AB77B07B42396C25F`, rebuilt a distinct encrypted
   live database (`81D602BDC2406D200FE37344C9813B305E56CA2ECB99A7B806A73D83F60C54C6`), and restored the exact UI.
6. Rollback files were deleted again. A second cold launch used only the rebuilt SQL database,
   showed no recovery warning and retained the same state.
7. The product's three-confirmation local clear initially exposed a real writer/direct-commit lock
   race. Quiescing and draining the live writer fixed it. The rerun reported `Local data cleared`,
   removed parked and backup generations, and cold-launched into `Your first picture` with the
   explicit no-sample-data copy and no drill values or lock/fatal log marker.

Evidence:

- `melo-android-sqlcipher-migration-2026-07-16.png`
- `melo-android-sqlcipher-only-cold-start-2026-07-16.png`
- `melo-android-sqlcipher-native-corruption-recovery-2026-07-16.png`
- `melo-android-sqlcipher-rebuilt-only-cold-start-2026-07-16.png`
- `melo-android-sqlcipher-local-clear-fixed-2026-07-16.png`
- `melo-android-sqlcipher-final-empty-cold-start-2026-07-16.png`

This proves Android SQLCipher is the current lossless UI-state and workspace-root authority. It is
not a claim that all AppState fields have already been normalized into final domain tables.

## Cleanup

- The app-private files directory was restored to mode `771` and verified.
- Quiet Mode was restored to off, saved and verified after a second cold launch.
- The real three-confirmation `Clear local money & history` action removed the temporary test
  state, verified backup and parked unreadable ciphertext, then recreated only the canonical
  encrypted empty workspace generation. A cold launch retained that empty state.
- The first cleanup attempt stopped after confirmation two of three and therefore changed
  nothing; completing the final `CLEAR LOCAL DATA` gate succeeded. No deletion-code defect was
  hidden or claimed.
- The cleared account no longer renders the unsupported `You make it to payday` claim over £0. It
  now shows the existing honest `Your first picture` doorway without auto-opening onboarding and
  without adding sample values. Evidence:
  `melo-android-post-clear-empty-doorway-2026-07-16.png`.
- Temporary `/sdcard/melo-*` and test XML artifacts were removed.
- The bounded `tmpfs` mounts were unmounted, all filler files disappeared with them, and `/data`
  returned to about 4.30 GB free.
- The final PDF/CSV/TXT/export/image test inputs were removed from Downloads. The package was
  cleared after the import and migration proofs, relaunched, and showed `Your first picture`; `Low
storage`, `StorageShop`, `Migration proof`, the five statement candidates and every earlier
  restore/offline test value were absent.
- No shipped fixture or sample record remains. The reversible values entered through onboarding
  solely for these drills were removed by the corrected, verified local-clear flow. At the earlier
  in-app-clear checkpoint, the encrypted empty workspace was 3,452 bytes with no backup,
  unreadable, corrupt, sample, fixture or offline-named app-private artifact. The final
  package-clear checkpoint intentionally starts before the first workspace write.
- The physical Galaxy S9 was not modified during the failure injection.

## Verification

- Full repository CI passed: 202 test files and 2,460 tests, plus dependency boundaries, V1
  separation, synthetic-data policy, product constitution, canonical product gates, formatting,
  all TypeScript targets, Worker types, contracts and source-package validation.
- The first native packaging attempt exposed a missing explicit Metro entry-point mapping for
  `@folio/storage`. `apps/mobile/metro.config.cjs` now maps the shipping workspace package directly;
  the arm64 and dual-ABI release builds both pass Metro and Gradle packaging.
- A release-mode arm64 build signed on the Galaxy S9's existing debug-certificate chain was
  installed with `adb install -r`. The package data was preserved, the process started, and the
  post-launch log contained no fatal Android or React marker.
- `melo-android-phone-persistence-build-2026-07-16.png` shows that current build running on the S9
  after the preserved-data update. No failure injection or sample data was placed on the phone.
- The final upload-signed dual-ABI APK was installed over the emulator's existing package and
  started with no fatal marker. App-private file permissions remained `771`, and `/sdcard` had no
  `melo-*` artifacts.

Current distribution artifacts after the import/privacy/recovery hardening pass:

- Path: `apps/mobile/android/app/build/outputs/apk/release/app-release.apk`
- Package: `com.folio.v2.greenfield` `0.0.1` (`1`)
- Android: minimum 24, target 36
- ABIs: `arm64-v8a`, `x86_64`
- APK size: `109,035,615` bytes
- APK SHA-256: `08D73315D240EB9996D1C4D14D73A327D7468A0367B9F8B37A5D2AEE0D16FA72`
- AAB size: `76,959,006` bytes
- AAB SHA-256: `50E1952891C137D2F98899F314A4BB24CB4700510A6A6DB8A9644DEE0E1D5532`
- Release JS size: `7,925,292` bytes
- Release JS SHA-256: `4C7BFAC2512C5BFD62EB672F8E26E2806ECC421A29020F5FF9C364FE27CBA629`
- Signer certificate SHA-256:
  `547396E1FD99681C2A6D768B8B7D1B4484B5F42A17597CAD6C495221267A5488`
- APK Signature Scheme v2 verification passed.

## Remaining T132 work

1. Complete release-device low-storage coverage across import, edit and restore boundaries. Android
   encrypted-state write and PDF-source retry are proven; automated encrypted-source promotion and
   deletion failure behavior is also proven.
2. Kill the process during real PDF/image/CSV imports and verify idempotent recovery. Automated boot
   reconciliation now removes active-workspace encrypted `.tmp` files and promoted encrypted files
   that have no committed evidence metadata, while preserving other-workspace files and retaining
   bytes when directory enumeration fails; release-device kill timing remains to be exercised.
3. Exercise every staged/tmp and backup corruption combination, including loss of every recoverable
   generation, on production builds. The automated 47-case suite covers the full ordering and
   preservation combinations; the release APK proves scoped-tmp recovery plus whole-SQL-database
   quarantine/rebuild.
4. Complete long-running import endurance with reviewed real-format PDF/image/CSV data; the
   bounded encrypted-Folio-state airplane-mode daily loop above is complete.
5. Complete iOS portable-export restore plus cloud zero-knowledge/cross-device restore and replay;
   the clean-sandbox Android portable-export round trip is now proven.

Until those rows pass, T132 and `RB-VAULT-REAL-DATA-E2E` remain release-blocking.
