# Android Melo companion depth - 15 July 2026

Historical evidence note: this document records the earlier depth pass. The later completion build,
expanded calculations and final physical retest are recorded in
`ANDROID_MELO_COMPANION_COMPLETION_2026-07-15.md`.

## Verdict

The expanded deterministic Melo companion runs in the current native Android application on the
physical Samsung Galaxy S9. The verified build answered payday and purchase questions from the
existing local money picture, resolved a bounded amount follow-up, and opened the real Safe Zone
surface from an answer action. The test created no financial record and added no sample data.

This proves the exercised Android paths. It is not an independent security assessment, packet
capture, accessibility audit, or proof of unexercised routes.

## Device and install

- Device: Samsung Galaxy S9 (SM-G960F), serial `2af26a2c19017ece`.
- Package: `com.folio.v2.greenfield`, version `0.0.1`, version code `1`.
- Original first-install time remained `2026-06-26 15:22:33`.
- Final update time: `2026-07-15 14:31:11`.
- The app was updated with `adb install -r`; it was not uninstalled, reset, or reseeded.
- Phone-only APK:
  `artifacts/android-physical-private/melo-expanded-local-companion-final-2026-07-15-debug-signed.apk`
- SHA-256:
  `A9646BFCCECE9C19AA65CD1B6739FE101F65154982DF62F10E08CD5353E9FDF5`
- APK Signature Scheme v2 and v3 verification passed under the historical debug certificate already
  installed on this phone.

The phone-only APK is not the Play-distribution artifact. Production signing migration and a
version-code bump remain release tasks.

## Exercised companion paths

### Payday

Prompt: `When is my next payday`

Observed result:

- displayed the real route date as `Monday, 3 Aug`, not a raw ISO date;
- described the negative position as `GBP 100 below` the Safe Zone target instead of saying
  `-GBP 100 available`;
- offered the real Payday ritual and Calendar destinations;
- kept one useful follow-up, with no duplicate action labels;
- kept the Send control fully visible beside the composer on the small Android viewport.

Evidence: `android-melo-expanded-local-payday-2026-07-15.png`.

### Bounded amount follow-up

Prompts in one transient session:

1. `Can I afford 40`
2. `what about 20`

Observed result:

- the second prompt reused only the typed prior purchase intent and detected amount context;
- it recalculated the answer for GBP 20 rather than treating the prompt as unrelated;
- it rendered three relevant reviewed actions, not a six-choice action/chip pile;
- no action was confirmed and no ledger write occurred.

Evidence: `android-melo-bounded-followup-2026-07-15.png`.

### Deterministic action navigation

Tapping `Show why it is short` opened the existing Safe Zone sheet. That sheet showed the same
underlying figures used by the answer: GBP 0 in the account, GBP 0 Bills Shield and a GBP 100 user
buffer, producing a -GBP 100 Safe Zone position.

Evidence: `android-melo-local-action-safe-zone-2026-07-15.png`.

### Post-test state

The app was force-stopped and cold-started after the exercise. It returned to Today with the
existing user-set GBP 0 picture, no sample transactions, no review candidates and no persisted chat
surface.

Evidence: `android-melo-expanded-companion-post-test-clean-2026-07-15.png`.

## Privacy and write boundary

- Mobile answers use the deterministic local responder and the aggregate `MeloLocalFinancialSnapshot`.
- The snapshot contains totals and counts, not names, merchants, transaction rows, account IDs,
  subscription names or pot names.
- Conversation calculation context contains only the previous typed intent and detected amount; it
  does not contain the raw previous prompt or transcript.
- Both purchase prompts were hypothetical, so the completed-event parser produced no write
  suggestion.
- The process log collected across the prompts and action navigation contained no matches for
  OpenAI, OpenRouter, Anthropic, the Melo AI gateway, `workers.dev`, or chat-completion endpoints.

The log scan is supporting evidence, not a packet capture. Independent traffic inspection and a
mobile security review remain required before public release.

## Validation

- `@folio/ai-contracts` TypeScript build passed.
- Mobile TypeScript build passed.
- Focused companion suite passed: 4 files, 54 tests.
- Full repository CI passed: 181 test files, 2,245 tests, plus boundaries, synthetic-data policy,
  formatting, all TypeScript builds and documentation contracts.
- Android `:app:assembleRelease` passed with `NODE_ENV=production`.
- The build emitted only the known Sentry source-map upload configuration warning.

## Honest remaining companion limits

The current companion core is materially deeper, but Personal v1 is not complete. It still needs:

- exact debt payoff, overpayment and BNPL calculations;
- goal pace, target-date feasibility and contribution trade-offs;
- irregular-income low/base/high scenarios with visible uncertainty;
- correction, cancel and explicit account-selection turns;
- per-number source explanations beyond the current aggregate Safe Zone path;
- import duplicate/conflict explanations and exact recovery comparisons;
- small-phone large-text, TalkBack, VoiceOver and iOS verification;
- independent privacy, security and adversarial evaluation.

The UI deliberately no longer offers debt-overpayment, goal-pace, contribution or low-month prompts
that imply those missing engines already exist.
