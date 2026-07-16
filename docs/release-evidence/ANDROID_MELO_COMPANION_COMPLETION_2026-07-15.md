# Android Melo companion completion evidence - 15 July 2026

## Verdict

The final deterministic Personal companion build runs in the current native Android app on the
physical Samsung Galaxy S9. The exercised flows used the existing local money picture, added no
sample data, created no financial record and made no direct ledger write.

The pass also caught a natural-language continuity defect: after an account answer,
`Where did that come from?` initially fell back to generic help. The resolver, typed source result
and regression coverage were corrected, the full repository gate was rerun, a new APK was built and
the exact flow then passed on the phone.

This proves the exercised Android implementation. It is not an independent accessibility audit,
packet capture, penetration test, iOS result or production TrueLayer pilot.

## Device and preserved install

- Device: Samsung Galaxy S9 (`SM-G960F`), serial `2af26a2c19017ece`.
- Package: `com.folio.v2.greenfield`, version `0.0.1`, version code `1`, target SDK `36`.
- Original first-install time remained `2026-06-26 15:22:33`.
- Final update time: `2026-07-15 16:12:12`.
- The physical build was installed with `adb install -r`; the app was not uninstalled, reset or
  reseeded.

## Final artifacts

Production-signed release:

- `artifacts/android-physical-private/melo-companion-completion-2026-07-15-production-signed.apk`
- size: `66,618,567` bytes;
- SHA-256: `5778F982F512E6CACAD863A3F177681CA0C083CD43AE49DD60397E6F1636E3F4`;
- signer: `CN=Folio, OU=Folio, O=Folio, L=Verona, C=IT`;
- certificate SHA-256:
  `547396E1FD99681C2A6D768B8B7D1B4484B5F42A17597CAD6C495221267A5488`;
- APK Signature Scheme v2 verification passed.

Physical-test update signed with the historical debug key already installed on this phone:

- `artifacts/android-physical-private/melo-companion-completion-2026-07-15-physical-debug-signed.apk`
- size: `66,713,790` bytes;
- SHA-256: `08D44F1146460F1D259772D303E6A682472BD548645872890AE189D141372F88`;
- certificate SHA-256:
  `FAC61745DC0903786FB9EDE62A962B399F7348F0BB6F899B8332667591033B9C`;
- APK Signature Scheme v3 verification passed.

The physical-test APK is not the Play-distribution artifact. The separate copy exists only because
Android will not update an existing debug-signed install with the Folio production certificate
without uninstalling and losing local app data.

## Exercised flows on the final APK

### Melo remains a primary product surface

The current Melo destination and `Talk to Melo` entry ran inside the existing native app rather
than a Lovable prototype or recreated sample shell.

Evidence: `android-melo-retest-nav-2026-07-15.png`.

### Multiple-amount ambiguity

Prompt: `Can I spend 20 or 30`

Observed result:

- Melo did not guess;
- it stated that it found GBP 20 and GBP 30;
- it asked for one amount and rendered `Check GBP 20` and `Check GBP 30` choices;
- no financial action was proposed or written.

Evidence: `android-melo-completion-amount-ambiguity-2026-07-15.png`.

### Explicit cancellation

Prompt after the ambiguous question: `cancel`

Observed result: `Cancelled. Nothing changed.` The pending task was cleared and no record was
created or reversed.

Evidence: `android-melo-completion-cancel-2026-07-15.png`.

### Local account selection and aggregate answer

Prompt: `What is my account balance`

The one existing local account was selected without combining balances. Melo showed its local GBP 0
balance, as-of date and the distinction between account balance and consolidated Safe Zone, with a
route to the real Accounts surface.

Evidence: `android-melo-retest-account-2026-07-15.png`.

### Natural source continuity

Follow-up in the same transient session: `Where did that come from`

The final build kept the prior `review_accounts` intent and local selected-account ID, then returned
only:

- GBP 0 selected-account balance;
- `current balance setting` as the source kind;
- one confirmed source record;
- a route to open the local Accounts surface for names and row-level evidence.

The typed calculation result did not contain the account name or ID. The name was added only by the
local on-device rendering boundary.

Evidence: `android-melo-completion-local-sources-fixed-2026-07-15.png`.

### Post-test state

After dismissing chat, the app returned to Today with the same user-set zero money picture. The
exercise did not add sample transactions, Review items or financial events.

Evidence: `android-melo-completion-post-test-today-2026-07-15.png`.

## Privacy sanity check

After clearing logcat, a local companion question produced 79 app-process log lines. The scan found
zero matches for OpenAI/Anthropic endpoints, the AI gateway, chat/response routes, statement-reader
routes or raw-prompt/raw-document markers.

This is supporting process-log evidence, not a network packet capture. Independent traffic
inspection and mobile security review remain public-release gates.

## Validation

- Focused post-fix contract/mobile suite: 3 files, 62 tests passed.
- Mobile and `@folio/ai-contracts` TypeScript builds passed.
- Final repository CI: 184 test files, 2,281 tests passed.
- Dependency boundaries, V1 hash boundary, sample-data policy, product constitution and canonical
  product gates passed.
- Formatting, all package/service typechecks, documentation package validation and fixture
  consistency passed.
- Android `:app:assembleRelease` passed with `NODE_ENV=production`.
- The only Android build warning was the known optional Sentry source-map upload configuration.

## Honest remaining gates

- Independent TalkBack/VoiceOver, large-text, switch-control and reduced-motion audit.
- Signed iOS install/launch and companion-path evidence.
- Independent security, adversarial and packet-level privacy review.
- Public store, billing, DPIA/legal and operations gates in the release-blocker register.
- Business workspace implementation and isolation proof.
- TrueLayer procurement, live credentials, balance contract, sandbox matrix and real-bank pilot.
