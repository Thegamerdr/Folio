# Melo companion completion map

Status: Personal deterministic companion coverage, including reviewed existing-transaction
corrections, is implemented and physically verified on Android. Public-release accessibility,
independent security/adversarial review, iOS evidence and the separate Business workspace remain
incomplete. Last verified: 2026-07-15.

## Product rule

Melo is the app and the companion. It remains in primary navigation. Chat is a secondary way to ask
for help, not the primary product UI: the ten-second glance, Safe Zone, money weather, payday loop,
Review and recovery path must work without composing a prompt.

Financial conclusions remain deterministic and explainable. No language model decides whether a
purchase is safe, changes a balance, classifies a record as truth or chooses a debt strategy. Remote
AI is not required for the Personal companion paths below.

## What the current Personal companion does

### Local money context

- Builds an aggregate local snapshot with available-now, tightest point, protected-item labels,
  every pending-review queue, payday, recurring total, monthly income/outgoings, debt/goal totals,
  upcoming-calendar count, unseen-change count, account counts and irregular-income state.
- Excludes names, merchants, transaction rows, account IDs and sample money from the snapshot.
  Real-user snapshots purge shipped seed records before route calculation.
- Reads raw local state only inside the calculation adapter and returns typed aggregate results.
  Named records are shown only when the user opens the relevant local surface.

### Deterministic coverage

Melo supports fourteen money intents plus clarification:

1. purchase check;
2. position and Safe Zone explanation;
3. subscription review;
4. recurring-payment review;
5. monthly summary;
6. import review;
7. recovery planning;
8. payday;
9. debts and BNPL;
10. savings goals;
11. calendar;
12. what changed;
13. irregular income;
14. account-specific position;
15. clarification when the request is missing or ambiguous.

The deeper local engines now include:

- contractual-minimum, highest-rate-first and lowest-balance-first debt projections, with exact
  integer-pence overpayment comparisons and no claim that one strategy is universally best;
- BNPL schedule projection from the terms actually stored by Melo, with an explicit warning when a
  real provider uses a different cadence;
- goal pace, target-date feasibility, contribution preview and Safe Zone trade-off;
- irregular-income low/base/high percentiles only after enough observed months, labelled as a range
  rather than a prediction;
- aggregate source explanations for Safe Zone, month, debt, goal and an explicitly selected account;
- import duplicate, changed-amount, missing-date and relationship proposals without automatic merge;
- recovery before/after comparison using the same pure preview engine as the Recovery screen.

### Conversation continuity

- Retains only typed prior intent, detected amount, selected debt strategy and a local selected
  account ID for the transient session. It does not retain the previous raw prompt or transcript for
  calculation.
- Handles bounded follow-ups, amount correction, explicit cancel/back, debt-strategy choice and
  account selection without guessing.
- Detects multiple amounts and asks which single amount to use.
- Keeps natural source follow-ups such as `Where did that come from?` attached to the prior metric.
  The selected account name remains local; the typed source result contains only its amount, source
  kind and confirmed-record count.

### Actions and truth boundary

- Opens the real What-if, Review, Recovery, Payday, Subscriptions, Accounts, Pots, Calendar,
  Timeline and Safe Zone surfaces.
- Recognises explicit completed spend, income, refund and transfer statements and prepares a local
  confirmation suggestion. Hypothetical wording cannot create a write suggestion.
- Recognises explicit pause/resume commands for an existing local subscription, resolves only an
  exact or unambiguous row, and previews the exact active-recurring-total change before routing to
  Subscriptions. Missing, unknown, duplicate and corrupt-amount cases do not guess or mutate.
- Keeps pause/resume outside Melo's direct write bridge. The owner-approved Melo tool set remains
  the four ledger tools; the dedicated Subscriptions surface owns the reversible state change and
  now gives both pause and resume a 30-second Undo path.
- Intercepts explicit existing-transaction amount/date corrections before completed-money-event
  parsing. Melo cannot see enough row data to resolve the target, so it makes no suggestion and
  opens Timeline for exact local selection instead of guessing.
- Gives the selected transaction a two-step edit flow: the shared pure engine shows only real
  before/after field changes, `Confirm changes` commits the same comparison as immutable correction
  records, and the existing 30-second Undo path can restore the prior editable values.
- Requires user confirmation before a proposed money event is written and supports undo.
- `cancel` dismisses the current proposal or question and never reverses an already confirmed
  ledger record.
- Import, bank and extraction results remain Review candidates. They never become ledger truth from
  companion text alone.

### Provider boundary

- Current mobile companion answers use no network or model provider.
- The deployed optional AI gateway accepts only a bounded enum/placeholder phrasing envelope; raw
  chat and document routes return HTTP 410.
- Raw PDF/image reading is on-device in the current native path. Client-side backup encryption uses
  AES-GCM before any encrypted backup blob leaves the device.

## Verification

The final Android pass used a production-bundled APK on a physical Samsung Galaxy S9 and preserved
the existing local install/data with `adb install -r`. It verified amount ambiguity, cancellation,
account-specific answers, natural source continuity and a clean return to Today without adding
sample or financial records.

See `docs/release-evidence/ANDROID_MELO_COMPANION_COMPLETION_2026-07-15.md` and
`docs/release-evidence/ANDROID_MELO_SUBSCRIPTION_REVIEW_2026-07-15.md`. Existing-transaction
correction handoff and review evidence is recorded in
`docs/release-evidence/ANDROID_MELO_TRANSACTION_CORRECTION_2026-07-15.md`.

The latest repository gate passed 190 test files and 2,345 tests, plus formatting, package/service
typechecks, dependency boundaries, sample-data policy, product gates and documentation validation.

The local adversarial boundary now runs before ordinary intent and write-proposal parsing. It blocks
instruction-changing/data-extraction wording, refuses non-finite or structurally invalid local money
values, re-resolves rapidly changing subscription/account state, and routes formal debt, tax,
credit/investment selection, legal-dispute and immediate-needs language without making a regulated
decision. Immediate-needs and formal-debt routes expose fixed official GOV.UK/MoneyHelper actions;
the selected companion tone cannot decorate or soften these responses. See
`docs/release-evidence/ANDROID_MELO_ADVERSARIAL_SAFETY_2026-07-15.md`.

The inherited four-style companion preference is now a single persisted app-wide setting. Chat and
Today read the same value directly. Calm, Honest and Dry suppress only proactive money-move nudges;
Coachy may surface the existing subscription-pause and low-point-goal prompts. Factual spend review,
Review tasks, recovery, safety and every deterministic number remain tone-invariant. See
`docs/release-evidence/ANDROID_MELO_TONE_GUIDANCE_2026-07-15.md`.

## Remaining Personal v1 release gates

These are release/assurance gaps, not missing deterministic calculation engines:

- independent TalkBack, VoiceOver, large-text, switch-control, reduced-motion and cognitive
  accessibility review across Android and iOS;
- iOS install, launch and companion-path evidence on a signed build;
- independent mobile/cloud/provider threat review, penetration testing and packet-level privacy
  inspection;
- independent red-team and human safety review beyond the checked-in local adversarial matrix,
  including future rapid Personal/Business workspace changes once Business persistence exists;
- public-release billing, store declaration, legal/DPIA and operations gates already tracked in the
  release-blocker register.

## Business companion boundary

Business is a separate product gate. The customer, information architecture, workspace-isolation
rules, commercial hypothesis and implementation order are mapped in
`MELO_BUSINESS_AND_OPEN_BANKING.md` and `MELO_BUSINESS_ALPHA_BUILD_PLAN.md`.

Production schema v9 has a locked, persisted Personal workspace/data-partition root. Schema v10
adds non-null ownership to every independently addressable AppState row, complete-row query/write
guards and an explicit scoped repository. Secondary APIs now require workspace ownership for
notification runtime, backup/restore/deletion, native persistence, companion read cache and widget
projection; search/storage were already workspace-keyed, and native document extraction is
transient. Cloud backup and Open Banking have disjoint opaque workspace paths and attack tests.
There is still no separate physical Business AppState/file/SQLite partition, derived Business key,
creation/switcher UI or Business companion context. Business Melo must not launch until those real
partitions and lifecycle flows exist and pass rapid-switch/device tests. No Personal prompt,
account or memory may leak into Business.

## Open Banking boundary

The optional TrueLayer Data v3 Worker is deployed but intentionally unconfigured. Accounts and
transactions are implemented through the hosted flow, encrypted provider identifiers and
Review-before-truth staging. Live provider credentials, commercial/regulatory approval, balance
support and real-bank evidence remain external activation gates. Manual entry and on-device import
remain complete without Open Banking.

The checked-in next Worker/mobile boundary also scopes connection indexes, encrypted records,
callback state, sync and disconnect to an opaque workspace reference and purges all workspace
records on account deletion. New provider ciphertext is AES-GCM-bound to the hashed user,
workspace and connection. This version has passed local attack tests but has not been deployed; the
deployed unconfigured version must not be described as having this update yet.

See `TRUELAYER_ACTIVATION_CHECKLIST.md`.

## Optional later work

- voice input/output;
- remote natural-language paraphrasing through the enum-only gateway;
- personality/voice packs and cosmetic reactions;
- household/shared context;
- international localisation;
- open-ended general-knowledge chat.

These do not compensate for missing release assurance or workspace isolation and should not delay
the local product.

## Current verdict

The Personal companion's intended local calculation, conversation and reviewed existing-record
correction coverage is functionally implemented. Melo as a publicly released product is not fully
complete until the remaining accessibility, iOS, independent security/adversarial, store/legal and
operations gates pass. Business Melo and live Open Banking are separate incomplete workstreams and
must not be described as shipped.
