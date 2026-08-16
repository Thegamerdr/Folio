# SDK, Permission And Financial Declarations

## Status

Android 1.0.0 candidate inventory complete on 20 July 2026. Play Console submission and the
comparison against the Play-processed artifact remain blocked.

Candidate evidence:

- AAB: `artifacts/melo-1.0.0-android-release-2026-07-20/melo-1.0.0-1-release.aab`
- AAB SHA-256: `3B4B36402D0555B6E210082FCC9D9FCE79D39C059740A0B8B882DA5BE473E5A4`
- AAB size: `98,858,840` bytes
- APK: `artifacts/melo-1.0.0-android-release-2026-07-20/melo-1.0.0-1-release.apk`
- APK SHA-256: `263766296462BE6073C8DD8DB615BB528D2E4A8154664F476FA4973DAFCF250F`
- APK size: `138,482,966` bytes
- Bundletool validation: passed
- APK signature validation: passed with APK Signature Scheme v2
- Upload-certificate SHA-256:
  `54:73:96:E1:FD:99:68:1C:2A:6D:76:8B:8B:7D:1B:44:84:B5:F4:2A:17:59:7C:AD:6C:49:52:21:26:7A:54:88`
- Physical-device smoke: passed on Samsung SM-G960F; release activity remained resumed with zero
  crash markers.

## Android Artifact Scope

- Package: `com.melomoney.app`
- Version name / code: `1.0.0` / `1`
- Minimum / target SDK: `29` / `36`
- ABI in the store bundle: `arm64-v8a`
- Release hardening: R8 enabled, resources shrunk, `android:allowBackup="false"`, cleartext traffic
  not enabled, debug mode not enabled.
- Verified app link: `https://melo-money.com/open`
- Custom schemes: `melo://` and the pre-release compatibility scheme `folio://`

## Manifest Permission Inventory

| Permission                                 | Why it is present                                                                  | User-facing behavior                                          |
| ------------------------------------------ | ---------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| `INTERNET`                                 | Optional cloud backup, Open Banking, billing verification, updates and diagnostics | The local personal core remains usable without a network      |
| `ACCESS_NETWORK_STATE`                     | Detect connectivity before optional network routes                                 | No financial state changes because a network is absent        |
| `USE_BIOMETRIC`, `USE_FINGERPRINT`         | Device authentication for the local app lock                                       | Opt-in; no biometric template enters Melo                     |
| `POST_NOTIFICATIONS`                       | Local reminders and notification delivery                                          | Runtime opt-in on supported Android versions                  |
| `RECEIVE_BOOT_COMPLETED`, `WAKE_LOCK`      | Restore scheduled local reminders after restart                                    | No continuous background financial processing                 |
| `FOREGROUND_SERVICE`                       | Expo notification/runtime support                                                  | No background microphone or camera capture                    |
| `VIBRATE`                                  | Notification and interaction feedback                                              | No data access                                                |
| `MODIFY_AUDIO_SETTINGS`                    | Expo audio playback support                                                        | Playback only; recording is disabled                          |
| `com.android.vending.BILLING`              | Melo Plus and Melo Pro subscriptions                                               | Purchase confirmation is owned by Google Play                 |
| FCM receive / dynamic receiver permissions | Expo notification transport                                                        | Notification content follows Melo's lock-screen privacy rules |
| Play install-referrer binding permission   | Google Play distribution metadata made available to bundled Google components      | No advertising or attribution SDK consumes it in Melo code    |
| Launcher badge permissions                 | App-icon notification badges on supported launchers                                | No data access                                                |

Explicitly absent from the merged release manifest:

- `CAMERA`
- `RECORD_AUDIO`
- `READ_EXTERNAL_STORAGE`
- `WRITE_EXTERNAL_STORAGE`
- `SYSTEM_ALERT_WINDOW`

The native file and image pickers use Android's system-owned picker. Melo receives only the item
the user selects.

## SDK And Service Inventory

| SDK or service                                | Release use                                                           | Data boundary                                                              |
| --------------------------------------------- | --------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Expo / React Native runtime                   | App shell and native platform adapters                                | Runs in the app process                                                    |
| OP-SQLite with SQLCipher                      | Encrypted local ledger and state                                      | Local device storage                                                       |
| Expo Secure Store / Local Authentication      | Wrapped local keys and app lock                                       | Android Keystore / device authentication                                   |
| Expo Document and Image Pickers / File System | User-selected statement and export files                              | System picker; no broad storage permission                                 |
| Expo Notifications / Updates                  | Local reminders, FCM transport and the production OTA channel         | Optional network route                                                     |
| Expo IAP                                      | Google Play subscription purchase and restore                         | Google Play owns checkout; Melo verifies the token server-side             |
| Sentry React Native                           | Privacy-minimised crash diagnostics                                   | No screenshots, session replay or financial payloads                       |
| Clerk Expo                                    | Optional account identity                                             | No production publishable key is embedded in the current Android candidate |
| Cloudflare Workers / KV                       | Public site, optional service endpoints and signed entitlement grants | Server routes receive only their documented request contract               |
| TrueLayer-compatible Open Banking adapter     | Optional bank-consent and candidate retrieval route                   | No provider credential is embedded in the app                              |
| Noble cryptography packages                   | Local encryption and signed entitlement verification                  | Runs locally                                                               |
| React Native Android Widget                   | Safe Zone home-screen widget                                          | App-owned widget snapshot only                                             |

No advertising, attribution, cross-app tracking or data-broker SDK is included.

## Google Play Financial Features Position

Recommended declaration for the submitted Android binary:

- Select `Support services > Other`.
- Describe the feature as personal and business budgeting, cash-flow planning, tax-liability
  preparation and optional read-only account-information aggregation.
- Do not select lending, payments, wallets, transfers, trading, crypto, insurance, credit
  reporting or buy-now-pay-later categories.
- Do not select `Financial advice`; Melo organises user-provided facts and presents deterministic
  planning options, but does not recommend regulated products or claim professional advice.

Melo does not:

- hold money or initiate payments;
- provide lending, credit broking, investment, crypto, insurance or money-transfer services;
- recommend regulated financial products;
- submit tax filings directly to HMRC.

Direct HMRC MTD submission remains a separately blocked programme. Business calculations are
preparation estimates and must not be described as filed returns.

## Remaining Console Proof

- Upload the final AAB to Play Internal testing.
- Compare Play's processed permission view and Data safety SDK list with this inventory.
- Complete Financial features, Data safety, content rating and target-audience forms.
- Test a listed subscription purchase, pending purchase, restore, Plus-to-Pro replacement,
  expiry and offline grace on the release build.
- Record the Play app-signing certificate and add it to `/.well-known/assetlinks.json`.

## Official Reference

- `https://support.google.com/googleplay/android-developer/answer/13849271?hl=en-GB`
