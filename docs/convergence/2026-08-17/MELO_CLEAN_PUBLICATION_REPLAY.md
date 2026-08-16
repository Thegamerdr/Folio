# Melo clean publication replay

Status: verified publication evidence, 2026-08-17.

## Authority and method

- Original reviewed tip: `71caffc5978d23e5ce68a15aee0f243575f54872`.
- Preserved local ref: `backup/melo-one-app-convergence-pre-publication-2026-08-17`.
- Clean foundation: `60d55ac0ed1ff9251eca2c5e9e0ec3fb3a65c077`, based directly on
  `origin/master` at `6afcbacab8192348628aa60e52c094967603fde1`.
- The 180 pre-plan convergence commits were represented by their final reviewed tree in one clean
  foundation commit. The accepted safety and authority commits were then replayed individually.
- `git diff --name-status` between the preserved reviewed tip and the replayed tip reported exactly
  the 63 deletions below and no source, test, migration, documentation or other evidence difference.
- The replay range introduces no blob at or above 100 MiB. Its largest retained blob is 32,520,401
  bytes.

## Accepted-plan commit mapping

| Work                          | Original commit                            | Replayed commit                            |
| ----------------------------- | ------------------------------------------ | ------------------------------------------ |
| MIGRATION-01                  | `af3ebcd52570c9989931ec8f5ebf154afbd66861` | `69806b0942f2bf24f0b57406fe6bbf476faf5def` |
| ISOLATION-01                  | `ccb74d11118bde799d4ad1706aaf3f6dd73856b9` | `fdc2344d36d306b2022c23f02f6d6dd2867edfe6` |
| TEST-01 composition           | `6fedc8c34f1aaad081cfbc635951890412f26bc9` | `4971d2283d775eed065e8ec0011abfc7e824ef66` |
| TRUST-01                      | `56bd6a0577ddb3818227d10a12ff5436397079f6` | `60b1fc5a92e6132ab177af488398aeea1e324056` |
| SECURITY-01                   | `b3d83cb373816be5251fb556872bb56cad337431` | `fb39fad6fce8417a049a5dadd4a8d9d443b9440c` |
| IMPORT-01                     | `59d117343492bc6ac74e8717b51b8e3954163c04` | `0bcc2417854f1fee8d07bcdd01e942f0aebfb9aa` |
| CALENDAR-01                   | `07dfd85ae87b2580b3ad585746f684dee555f9f8` | `00ccec0eda30e901f9449e149cf93b7646176af7` |
| TEST-01 final CI reachability | `3a1d394348d0b62f086fb47ebbbedf90d2c8a457` | `e4558a1048c290329d07df5d91772156efcb749b` |
| AUTHORITY-01 navigation       | `88a5ae320265dd0d5c6ffa486db1f74920147ad0` | `91bee8e8362b0c61e33182a627d159787e215ee5` |
| AUTHORITY-01 + DOCS-01        | `ad84793c714890ea2da3087972512c91f6c6ad60` | `b5782e0d36eb94d183e606173ae61f2533a4368f` |
| Publication-block record      | `71caffc5978d23e5ce68a15aee0f243575f54872` | `611b8840f4534b361f1c7a2e6ec76da7f696b8eb` |

## Excluded reproducible build outputs

The following build products, signatures and symbol bundles remain recoverable from the preserved
local ref and can be rebuilt from source. They are intentionally absent from published Git history:

- `artifacts/android-final-release/melo-arm64-release.aab`
- `artifacts/android-final-release/melo-arm64-release.apk`
- `artifacts/android-physical-private/melo-arm64-physical-debug-signed.apk`
- `artifacts/android-physical-private/melo-arm64-physical-debug-signed.apk.idsig`
- `artifacts/android-physical-private/melo-business-workspace-foundation-2026-07-15-physical-debug-signed.apk`
- `artifacts/android-physical-private/melo-business-workspace-foundation-2026-07-15-physical-debug-signed.apk.idsig`
- `artifacts/android-physical-private/melo-business-workspace-foundation-2026-07-15-production-signed.apk`
- `artifacts/android-physical-private/melo-business-workspace-row-isolation-2026-07-15-physical-debug-signed.apk`
- `artifacts/android-physical-private/melo-business-workspace-row-isolation-2026-07-15-physical-debug-signed.apk.idsig`
- `artifacts/android-physical-private/melo-business-workspace-row-isolation-2026-07-15-production-signed.apk`
- `artifacts/android-physical-private/melo-business-workspace-v11-2026-07-15-physical-debug-signed.apk`
- `artifacts/android-physical-private/melo-business-workspace-v11-2026-07-15-production-signed.apk`
- `artifacts/android-physical-private/melo-companion-completion-2026-07-15-physical-debug-signed.apk`
- `artifacts/android-physical-private/melo-companion-completion-2026-07-15-physical-debug-signed.apk.idsig`
- `artifacts/android-physical-private/melo-companion-completion-2026-07-15-production-signed.apk`
- `artifacts/android-physical-private/melo-companion-safety-boundary-2026-07-15-physical-debug-signed.apk`
- `artifacts/android-physical-private/melo-companion-safety-boundary-2026-07-15-physical-debug-signed.apk.idsig`
- `artifacts/android-physical-private/melo-companion-safety-boundary-2026-07-15-production-signed.apk`
- `artifacts/android-physical-private/melo-companion-subscription-preview-2026-07-15-emulator-x86_64-production-signed.apk`
- `artifacts/android-physical-private/melo-companion-subscription-preview-2026-07-15-physical-debug-signed.apk`
- `artifacts/android-physical-private/melo-companion-subscription-preview-2026-07-15-physical-debug-signed.apk.idsig`
- `artifacts/android-physical-private/melo-companion-subscription-preview-2026-07-15-production-signed.apk`
- `artifacts/android-physical-private/melo-companion-tone-boundary-2026-07-15-physical-debug-signed.apk`
- `artifacts/android-physical-private/melo-companion-tone-boundary-2026-07-15-physical-debug-signed.apk.idsig`
- `artifacts/android-physical-private/melo-companion-tone-boundary-2026-07-15-production-signed.apk`
- `artifacts/android-physical-private/melo-companion-transaction-correction-2026-07-15-physical-debug-signed.apk`
- `artifacts/android-physical-private/melo-companion-transaction-correction-2026-07-15-physical-debug-signed.apk.idsig`
- `artifacts/android-physical-private/melo-companion-transaction-correction-2026-07-15-production-signed.apk`
- `artifacts/android-physical-private/melo-expanded-local-companion-2026-07-15-debug-signed.apk.idsig`
- `artifacts/android-physical-private/melo-expanded-local-companion-final-2026-07-15-debug-signed.apk`
- `artifacts/android-physical-private/melo-expanded-local-companion-final-2026-07-15-debug-signed.apk.idsig`
- `artifacts/android-physical-private/melo-expanded-local-companion-ux-fixed-2026-07-15-debug-signed.apk.idsig`
- `artifacts/android-physical-private/melo-old-installed-base.apk`
- `artifacts/android-physical-private/melo-privacy-local-2026-07-15-debug-signed.apk`
- `artifacts/android-physical-private/melo-privacy-local-2026-07-15-debug-signed.apk.idsig`
- `artifacts/android-physical-private/melo-privacy-local-ocr-direction-2026-07-15-debug-signed.apk`
- `artifacts/android-physical-private/melo-privacy-local-ocr-direction-2026-07-15-debug-signed.apk.idsig`
- `artifacts/android-physical-private/physical-current-installed-2026-07-15.apk`
- `artifacts/billing-proof/melo-billing-x86_64-release.apk`
- `artifacts/cloud-backup-proof/melo-cloud-backup-arm64-release.apk`
- `artifacts/cloud-backup-proof/melo-cloud-backup-emulator-x86_64-release.apk`
- `artifacts/installed-phone-base.apk`
- `artifacts/melo-1.0.0-android-release-2026-07-20/mapping.txt`
- `artifacts/melo-1.0.0-android-release-2026-07-20/melo-1.0.0-1-release.aab`
- `artifacts/melo-1.0.0-android-release-2026-07-20/melo-1.0.0-1-release.apk`
- `artifacts/melo-1.0.0-android-release-2026-07-20/native-debug-symbols.zip`
- `artifacts/melo-android-arm64-release.apk`
- `artifacts/melo-android-emulator-x86_64-release.apk`
- `artifacts/ocr-proof/melo-local-ocr-x86_64-release.apk`
- `artifacts/open-banking-proof/melo-open-banking-x86_64-release.apk`
- `artifacts/rationale-aware-ui-audit-2026-07-19/melo-qa-lovable-refrozen-2026-07-19.apk`
- `artifacts/rationale-aware-ui-audit-2026-07-19/melo-qa-lovable-refrozen-complete-2026-07-19.apk`
- `artifacts/rationale-aware-ui-audit-2026-07-19/melo-qa-lovable-refrozen-complete-nosample-2026-07-19.apk`
- `artifacts/rationale-aware-ui-audit-2026-07-19/melo-qa-lovable-refrozen-complete-nosample-x86_64-2026-07-19.apk`
- `artifacts/rationale-aware-ui-audit-2026-07-19/melo-qa-lovable-refrozen-x86_64-2026-07-19.apk`
- `artifacts/rationale-aware-ui-audit-2026-07-19/melo-qa-pass1.apk`
- `artifacts/rationale-aware-ui-audit-2026-07-19/melo-qa-refrozen-final.apk`
- `artifacts/visual-reconciliation-2026-07-18/native-current/installed-base.apk`
- `tmp/installed-emulator-base.apk`
- `tmp/installed-s9-base.apk`
- `tmp/melo-s9-release-test.apk.idsig`
- `tmp/melo-schema-v11-current-debug-signed.apk`
- `tmp/melo-schema-v11-current-debug-signed.apk.idsig`

No repository, app runtime, feature implementation or release evidence document was otherwise
removed or replaced by this replay.
