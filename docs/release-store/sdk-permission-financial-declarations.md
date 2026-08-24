# Melo SDK, permission and financial-feature inventory — 2026-08-24

Status: **engineering inventory current; BLOCKED EXTERNAL for candidate-binary and console match.**

## SDK inventory

- Expo/React Native and Expo Router
- SQLCipher-backed local storage and Expo Secure Store/local authentication
- Clerk Expo (optional authentication)
- Sentry React Native (redacted crash diagnostics)
- Expo IAP (Full/Live billing seam)
- Expo document picker, image picker, sharing and WebBrowser
- Expo notifications/calendar surfaces and optional TrueLayer Open Banking adapter
- No advertising, attribution, tracking, behavioural analytics or raw AI chat SDK

## Permission/required-reason inventory

- Explicitly blocked in `apps/mobile/app.config.ts`: `READ_EXTERNAL_STORAGE`,
  `WRITE_EXTERNAL_STORAGE`, `RECORD_AUDIO`, `SYSTEM_ALERT_WINDOW`.
- User-mediated: document/photo picker, optional camera capture, notifications, calendar export,
  share/export, biometric/PIN lock and WebBrowser bank consent.
- Audio recording/background recording are disabled.

## Google financial-features draft

Melo organises user-provided financial records, budgets and forecasts, and stages imported rows for
user review. It does not initiate payments, hold money, recommend financial products or investments,
provide regulated advice, or file taxes directly. Open Banking is an optional adapter and remains
provider/legal gated; direct HMRC MTD is not shipped.

## Required external match

Review this inventory against the exact `app-release.aab`/iOS archive, privacy manifests and Play /
App Store Connect forms. Do not mark `binaryMatched` or `consoleSubmitted` from this draft alone.

Official reference: <https://support.google.com/googleplay/android-developer/answer/17105854>
