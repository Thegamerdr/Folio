# Google Play Data Safety — Melo 1.0.0

## Status

Candidate answers prepared from the Android source, merged manifest and local release artifact on
20 July 2026. Submission and comparison with Play's processed artifact remain blocked.

## Data Collection And Security

| Play question                                           | Candidate answer                          | Evidence                                                                                                              |
| ------------------------------------------------------- | ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Does the app collect or share required user-data types? | Yes — it collects the limited types below | Sentry diagnostics, billing verification and optional notification delivery transmit data off device                  |
| Is collected data encrypted in transit?                 | Yes                                       | Production routes use HTTPS                                                                                           |
| Can users request deletion?                             | Yes                                       | In-app account/cloud deletion plus `https://melo-money.com/delete-account`                                            |
| Is data shared with third parties?                      | No for the candidate declaration          | Sentry, Clerk, Cloudflare and Open Banking providers act as service providers; Google Play checkout is user initiated |
| Independent security review completed?                  | No                                        | Independent MASVS/penetration review remains open                                                                     |

Do not answer “no data collected”. Google defines collection as transmitting data off the device,
including SDK traffic and pseudonymous data.

## Data Types To Declare

| Data type                                                       | Collected / shared    | Required or optional                                             | Purpose                                                 | Candidate behavior                                                                                                         |
| --------------------------------------------------------------- | --------------------- | ---------------------------------------------------------------- | ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| App info and performance — Crash logs                           | Collected, not shared | Required while diagnostics are enabled                           | Analytics                                               | Sanitised Sentry crash type, stack and app/device metadata; no screenshots, breadcrumbs, user identity or financial values |
| App info and performance — Diagnostics / other performance data | Collected, not shared | Required while diagnostics are enabled                           | Analytics                                               | Crash-free session health only; performance tracing is disabled                                                            |
| Device or other IDs                                             | Collected, not shared | Required for diagnostics; optional for notifications and billing | App functionality, analytics, fraud prevention/security | Pseudonymous app/device identifiers, optional push token and billing installation identifier                               |
| Financial info — Purchase history                               | Collected, not shared | Optional                                                         | App functionality, fraud prevention/security            | Product ID, purchase token and entitlement status used to verify Plus/Pro and restore purchases                            |

## Data Types Not Collected By This Candidate

- User-entered balances, transactions, income, debts, pots, forecasts and business records are
  processed locally.
- Statement PDFs, images and derived text are processed on device and are not sent to a reader
  service.
- Melo conversation text and financial context are not sent to an AI provider.
- Local calendar events are app-owned; Melo does not read the user's system calendar.
- Camera, microphone, contacts and broad-storage permissions are absent.
- Encrypted cloud-backup ciphertext is not readable by the developer and is outside Play's
  collection scope when the documented end-to-end boundary holds.
- Optional identity, cloud and Open Banking data types must be added before enabling those
  production providers in a submitted binary.

## Security And Retention Checks Before Submission

- Confirm the production Sentry retention setting and processor agreement.
- Confirm every optional provider enabled in the Play build; update this matrix before upload if
  Clerk or Open Banking is enabled.
- Compare Play's SDK and permission view with
  `docs/release-store/sdk-permission-financial-declarations.md`.
- Complete an account/cloud deletion E2E against the production identity and storage providers
  before claiming provider-side deletion is proven.
- Keep the independent-security-review badge unselected until external review closes.

## Official Reference

- `https://support.google.com/googleplay/android-developer/answer/10787469`
