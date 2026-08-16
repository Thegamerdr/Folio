# Release checklist — Folio/Melo Android

Hard gates before the FIRST Play Console upload (each irreversible or blocking after upload):

1. **Package id / app name — PERMANENT once uploaded.** Current `com.folio.v2.greenfield` is an
   engineering codename (owner deferred the naming decision on 2026-07-05). Before first upload:
   run the naming session, pick the real reverse-DNS id under an owned domain, change
   `app.config.ts` (`android.package`, `ios.bundleIdentifier`, `name`), `expo prebuild --clean`,
   full rebuild. One commit — but only valid BEFORE upload #1.
2. **Signing.** Release builds sign with the real upload keystore only on machines that have
   `FOLIO_UPLOAD_*` in `~/.gradle/gradle.properties` (this MSI has them; keystore + password at
   `C:\Users\User\.folio-signing\` — **owner: back this folder up somewhere durable — losing it
   before enrolling in Play App Signing = losing the app identity forever**). Machines without
   the properties fall back to debug signing (plugin `apps/mobile/plugins/withUploadSigning.js`);
   never upload those.
3. **Upload format: AAB, not APK.** `gradlew bundleRelease` / EAS production profile. The 68MB
   arm64-only APK is for sideloading testers only.
4. **versionCode** must strictly increase every upload (currently 1). Bump in
   `android/app/build.gradle` via `app.config.ts` version — automate before regular releases.
5. **Privacy policy URL** — mandatory Play field. Draft lives at `PRIVACY_POLICY.md` (once
   written); needs real hosting (domain page or GitHub Pages) before submission.
6. **Data-safety form** — declare: Financial info (transactions/balances; statement images/PDFs
   leave the device to the owner-run Cloudflare gateway for reading); Photos (same gateway);
   Personal identifiers (Clerk email auth — third-party SaaS); Purchase history (Play Billing);
   No ads, no analytics SDK (truthfully "no collection" for app-activity if still true at
   submission).
7. **Account deletion path** — Play requires one when account signup (Clerk) exists. Verify the
   in-app wipe + Clerk account deletion story before submission.
8. **Crash reporting live** (Sentry DSN in place) before any external tester build.
9. **R8/resource shrinking on + release smoke-tested on device** (keep-rules iterated until the
   release build boots clean).
10. **Play Billing products** (`folio.plus.monthly` etc.) created in Play Console; billing E2E
    tested with a license-tester account before flipping any price live.
