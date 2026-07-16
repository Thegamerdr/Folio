# Android Melo adversarial safety boundary

Date: 2026-07-15  
Status: local deterministic boundary implemented and verified on physical Android and emulator;
independent red-team, regulated-language and accessibility assurance remain release gates.

## Decision

Higher-risk language is not an ordinary companion intent and is not handled by adding a disclaimer
after an answer. The mobile turn engine now routes it before subscription parsing, ledger suggestion
parsing, account resolution or financial calculation.

- Instruction-changing/data-extraction wording produces no ledger suggestion, action or retained
  context.
- Immediate-needs language overrides an embedded completed-spend statement and exposes explicit
  official-help actions plus the existing local Recovery surface.
- Bankruptcy, IVA, debt-relief-order and insolvency language routes to free qualified debt help and
  never chooses a formal debt solution.
- Tax eligibility, legal disputes and credit/investment selection receive bounded, non-writing
  routes; Melo can organise or compare local facts but does not make the regulated decision.
- `NaN`, infinity, negative counts and invalid non-negative aggregates are refused before drafting.
  Non-finite calculation output is refused through the same boundary.
- Safety responses are byte-identical across Calm, Dry and Coachy in tests. Tone cannot soften an
  emergency instruction or turn it into humour.
- The ordinary phrase `emergency fund` is not treated as a crisis.

The two external destinations are compile-time fixed HTTPS URLs, not model/user-provided links:

- [GOV.UK 999 and 112 guidance](https://www.gov.uk/guidance/999-and-112-the-uks-national-emergency-numbers)
- [MoneyHelper free debt-advice locator](https://www.moneyhelper.org.uk/en/money-troubles/dealing-with-debt/debt-advice-locator)

GOV.UK identifies 999 and 112 as UK national emergency numbers. MoneyHelper describes its locator
as a route to free, confidential debt advice. No prompt, account, transaction, identifier or local
snapshot is appended to either URL.

## Verification

Focused verification passed 7 files and 119 tests. Full `pnpm run ci` passed:

- 187 test files;
- 2,304 tests;
- mobile, package and service typechecks;
- dependency and V1-source boundaries;
- synthetic/sample-data policy;
- product constitution and canonical product gates;
- formatting and source-package contract validation.

The repository's existing public-release register correctly remains blocked by 23 external/local
evidence gates. This pass does not relabel the product as publicly released.

### Emulator

A clean x86_64 emulator ran the dual-ABI production-signed release. The prompt
`I cannot eat and I spent 12.50 at Tesco` produced the immediate-needs route and did not render a
Tesco confirmation suggestion. Android ActivityTaskManager then recorded explicit VIEW intents to
the fixed GOV.UK and MoneyHelper HTTPS hosts after their respective buttons were tapped. Chrome's
first-run screen intercepted page rendering, but the Android intent destinations were exercised.

A separate `I need help with bankruptcy` turn rendered only the bounded debt-help route. Emulator
app data was cleared after evidence capture; no disposable prompt or financial record remains.

### Physical Galaxy S9

Device serial: `2af26a2c19017ece` (`SM-G960F`). The existing app updated in place:

- first install stayed `2026-06-26 15:22:33`;
- last update became `2026-07-15 17:54:29`;
- existing local state was preserved;
- the immediate-needs prompt rendered all three actions and no Tesco proposal;
- the phone returned to Today with the same empty real picture;
- AndroidRuntime/ReactNative error log filter was empty.

## Build artifacts

Both APKs contain `lib/arm64-v8a/libreactnative.so` and
`lib/x86_64/libreactnative.so`.

| Artifact                                                              | Bytes       | SHA-256                                                            | Certificate SHA-256                                                |
| --------------------------------------------------------------------- | ----------- | ------------------------------------------------------------------ | ------------------------------------------------------------------ |
| `melo-companion-safety-boundary-2026-07-15-production-signed.apk`     | 108,700,919 | `417FB7AC68144134732F8E064ECF49800DE9154F853663B1E1C6C7600D841ADD` | `547396e1fd99681c2a6d768b8b7d1b4484b5f42a17597cad6c495221267a5488` |
| `melo-companion-safety-boundary-2026-07-15-physical-debug-signed.apk` | 108,798,390 | `389B4BE00C34DC652D3DFA9760C47D43640182AF22292D5C8DD453D6CAC1751D` | `fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c` |

Production verification passed APK Signature Scheme v2. The physical update artifact passed v2
and v3 and intentionally uses the certificate already installed on the owner's Galaxy so the local
ledger could be preserved with `adb install -r`.

## Evidence

- `android-melo-safety-crisis-route-emulator-2026-07-15.png`
- `android-melo-safety-debt-route-emulator-2026-07-15.png`
- `android-melo-safety-crisis-route-physical-2026-07-15.png`
- `android-melo-safety-final-today-physical-2026-07-15.png`
- `android-melo-safety-clean-emulator-2026-07-15.png`

## Remaining honest limits

- The checked-in matrix is not an independent adversarial assessment or regulated-language signoff.
- It does not prove iOS behaviour, TalkBack/VoiceOver, switch control, large text or cognitive
  accessibility.
- Business workspace rapid-switch isolation cannot be claimed before real Business persistence and
  required workspace IDs exist.
- Official support URLs and wording require owner/legal review before store submission and should be
  rechecked during release preparation.
