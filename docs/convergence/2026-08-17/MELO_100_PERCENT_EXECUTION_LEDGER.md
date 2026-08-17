# Melo 100% completion execution ledger

**Status:** controlling programme ledger, 17 August 2026  
**Product:** one Android/iPhone Melo application  
**Shipping runtime:** `apps/mobile`  
**Repository branch:** `codex/melo-one-app-convergence-2026-08-15`  
**Ledger baseline commit:** `8082bddb60082499491a7b62b3eca837e654f44a`

## Controlling plan

The controlling product plan is:

`C:\Users\User\Documents\Codex\2026-07-28\referenced-chatgpt-conversation-this-is-untrusted\work\MELO_AUTHORITATIVE_MASTER_PLAN_2026-08-16.md`

SHA-256:

`19F71D6367A1C8147BC6BE052385DAF1B80A809D8B9C8FE0D7551E311E2092E3`

That plan consolidates the full Lovable UI/UX audit, 92-screen and 41-sheet disposition, product
upgrade plan, financial-domain contract, accounts/data/security work, accessibility, operations,
the living-companion programme, mobile architecture, twelve delivery phases and the final release
matrix. It supersedes narrower phase reports, advisor plans, historical `STATUS.md` statements and
task-level completion messages when those conflict.

The ten files under `advisor-plans/` and commit `8082bdd` are completed checkpoints inside this
programme. They are not completion of the programme or product.

## Reporting rule

Every future handoff must report both:

1. the bounded checkpoint completed in that handoff; and
2. the remaining programme phases in this ledger.

No task, commit, test run, Android build, companion-engine pass or design pass may be described as
"the app is complete" unless every Product Launch Done requirement in master-plan section 23.3 has
evidence. A phase is not complete merely because its pure contracts or synthetic proof shell exist.

## Current programme state

| Phase                                        | Master-plan outcome                                                                                                 | Current evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Programme status                                                             |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------- |
| 0 — source-of-truth recovery                 | One cloneable repository and one-app lineage                                                                        | Existing GitHub repository, sole `apps/mobile` runtime, published authority documents and clean tracked branch                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | **Complete**                                                                 |
| 1 — decisions and contract freeze            | Navigation, account, Business, paywall, dark-mode and regulated boundaries fixed                                    | Four-tab contracts, local-first optional-account policy, narrow Business beta, prepare/export filing boundary and one-app authority are recorded                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | **Substantially complete; taxonomy/plan authority correction in progress**   |
| 2 — canonical visual kit                     | Sixteen-pattern kit, fixed type/spacing/radius, Lucide and shared states in Lovable                                 | Lovable head `c75dad...` contains the review/plan only. No product-code design pass followed `ef8d0cf...`. Mobile currently has about 1,350 raw `fontSize` declarations, 108 raw radii and a token-only shared UI package                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | **Not complete**                                                             |
| 3 — IA skeleton and scroll ownership         | Four tabs, hubs, all 92 IDs re-homed, route scroll fixed, no capability loss                                        | Mobile now has per-workspace/per-tab route stacks, correct Personal/Business tab ownership and an executable disposition for all 92 reference screens and 41 sheets. The Lovable IA/hub migration, visible native hub consolidation and reference scroll closure remain open                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | **Partial — native route ownership/reconciliation complete**                 |
| 4 — consolidated journeys                    | Shared intake result/help, Adjust Path modes, Review segments, Money Sources, Data & Security and Tax Pack          | The native Money Sources dashboard consolidates local accounts, imports/evidence, income and optional read-only bank sources with actions into the existing Account journey. Accounts can be added, renamed, balance-corrected, hidden, excluded, closed and restored without losing history. Intake history now exposes successful, duplicate-only, unreadable, unsupported-currency and retry attempts, pending counts and the saved-original viewer/removal controls. Review is now one navigable Check/Activity/Decisions/Sources journey while retaining the detailed native screens; Business queued review and activity history are reachable instead of looping back to the hub. Adjust Path now presents Preview, Resolve and Recovery as labelled modes with shared access to saved decisions, while retaining each mode's distinct emotional framing and money logic. Separate PDF/image/paste success/fallback compositions remain open for consolidation.                                                                     | **Partial — Money Sources, intake history, Review and Adjust Path complete** |
| 5 — trust and account designs                | Worked-out number, unconfirmed, account/recovery, sync/source/consent, entitlement and serious-money support states | Consequential Personal Trusted Safe Range and Business cash-runway figures now open one shared native explanation surface with live inputs, explicit arithmetic, calculation window, assumptions, source/freshness detail, limits and direct correction routes. Deterministic truth, export/delete, account and provider contracts exist; the complete approved reference-state set and every connected success/failure/revoke/recovery path do not                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | **Partial — worked-out flagship numbers complete**                           |
| 6 — native-fit reference freeze              | Safe areas, keyboard, 200% text, a11y, reduced motion and owner-approved design commit                              | Android hardening and some accessibility infrastructure exist. No final Lovable design-freeze commit or Android+iPhone design acceptance exists                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | **Not complete**                                                             |
| 7 — mobile foundation                        | Canonical shell, local DB/migrations, interfaces, engines, CI and internal builds                                   | Strong Android foundation, SQLCipher authority, migrations, deterministic engines, CI and signed Android build lane exist                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | **Substantially complete on Android; iPhone evidence open**                  |
| 8 — Personal launch                          | Complete offline local-first Personal journey and one Melo host                                                     | Major Personal screens and deterministic flows exist. GBP-only intake and money totals fail closed. Closed, excluded and foreign accounts retain history but leave current cash/debt/net/runway calculations; hidden accounts remain money-active but unavailable for new writes. Credit and overdraft facilities are reported separately and never become safe cash. Pending, reversed, void, transfer, refund, duplicate, replacement and exact split truth survives canonical/native persistence and export, drives truthful analytics, and is exposed through one unified transaction-detail surface with source evidence, lifecycle, relationships, refund/reversal/transfer actions and correction history. Recurring payday, fixed-grid income and last-working-day projections use the same versioned England/Wales bank-holiday calendar, move across substitute days and preserve the underlying cadence without drift. Master-plan journey consolidation, all shared states and Android+iPhone completion evidence remain open. | **Partial**                                                                  |
| 9 — accounts, sync, provider and entitlement | Real auth/recovery, encrypted sync, Money Sources, billing lifecycle, ownership controls                            | Local/contract foundations and some services exist. Account lifecycle policy, facility validation, canonical closed/archived projection, safe card-payment arithmetic and GBP-only provider/account selection are implemented. Money Sources now exposes provider scope, consent expiry, last refresh and distinct pending/stale/reauthorise/error/disconnected states, while retaining Review-first ingestion and an honest unavailable path. Real provider/account/store lifecycle and production deletion/recovery evidence remain open.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | **Partial**                                                                  |
| 10 — narrowed Business beta                  | Isolated Business Today/Money/Review, cash cycle and Tax Pack prepare/export                                        | Business contracts and screens exist, but creation is correctly gated until full physical isolation/lifecycle and beta acceptance exist                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | **Partial / gated**                                                          |
| 11 — authored Melo performance               | Approved compact performance library, wardrobe truth, live events and attention                                     | Persistent engine/host and tests exist; top-tier authored key art, semantic animation, broad runtime visual acceptance and final device evidence remain open                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | **Partial**                                                                  |
| 12 — release gate                            | Full matrix, approvals, signed store builds, support and rollout                                                    | Local signed Android APK/AAB and broad automated evidence exist; iPhone, stores, external reviews, production providers, operations drills and owner acceptance remain open                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | **Partial / release blocked**                                                |

## Full scope that remains controlled by the master plan

The following are programme work, not optional follow-ups:

### Product and UI/UX

- Implement and approve the canonical sixteen-pattern visual kit.
- Enforce the fixed type, spacing, radius, colour, icon, control and surface hierarchy.
- Implement the complete Personal and Business four-tab information architecture.
- Re-home every one of the 92 reference ScreenIds and 41 sheets without capability loss.
- Complete shared empty, loading, error, offline/stale, locked, unconfirmed, conflict, permission,
  expired-consent, queued, success/undo, deleted/restoring, large-text, reduced-motion and no-safe-Melo
  states.
- Consolidate intake, Review/history/corrections, Adjust Path, Money Sources, Data & Security and
  Business Tax Pack as specified, while retaining their distinct emotional/product roles.
- Preserve the signature Today path, Today-after, Ritual, Cycle Postcards, EarnStamp, Weekly
  Whispers, subscription check-ins, Payday Flex, Cycle Rollover, split, refund and transfer jobs.

### Financial truth and product capability

- Finish every launch-critical surface in section 13.1 of the master plan.
- Keep all screen calculations behind deterministic domain modules and one money truth.
- Close the complete financial edge-case matrix in section 14.2 with explanations and tests.
- Maintain versioned content/rates, jurisdiction/period, assumptions, rounding and fail-closed
  policy for consequential outputs.
- Complete multiple income, evidence, reconciliation, recurring detection, constrained-goal and
  other approved high-value mobile capabilities in their planned order.

### Accounts, privacy, security and lifecycle

- Complete real identity, verification, recovery, device/session and entitlement identity flows.
- Prove secure storage, migrations, encrypted backup/sync, conflicts, revocation and clean-device
  recovery without making claims ahead of evidence.
- Complete export, account/workspace deletion, retention and completion proof.
- Close analytics/crash/support redaction, processor inventory, DPIA, incident and store-disclosure
  work.

### Accessibility and inclusive finance

- Reach minimum target sizes and semantic labels across product surfaces.
- Close 200% text, keyboard, focus, contrast/non-colour, reduced-motion/data and chart equivalents.
- Complete TalkBack and VoiceOver critical journeys when the required hardware is available.
- Preserve serious-money support and suppress sales/celebration pressure in vulnerable states.

### Melo living companion

- Preserve one root instance, one canonical A+ identity and truthful fallback paths.
- Finish the exact authored locomotion, perch/peek, wing gesture, emotion, rest and wardrobe/model
  key art listed in master-plan section 18.4.
- Wire the final truthful Personal and Business domain events after IA consolidation.
- Complete context-aware attention, memory use, route choreography, safe placement, drag/tap/tuck/
  quiet/restore and lifecycle behaviour in the native host.
- Pass runtime-size art review, collision, low-memory, accessibility and low-end-device acceptance.

### Release and operations

- Complete the functional, lifecycle, device/accessibility, companion, performance, security and
  privacy matrices in master-plan section 22.
- Complete store declarations, real billing lifecycle, operations/tabletop evidence, independent
  reviews, store-processed builds, limited rollout and owner sign-off.
- Treat iPhone, unavailable physical devices, provider credentials and independent reviews as
  evidence gates to close when available; they do not stop unrelated local implementation work.

## Immediate execution order

Work continues in the master plan's order, while independent local implementation can proceed where
it does not depend on an unavailable external gate:

1. **Authority correction:** publish this ledger and remove the false "no further backlog" stop
   signal.
2. **Phase 2:** one bounded Lovable canonical-kit pass, then inspect its single diff once.
3. **Phase 3:** implement/verify the four-tab IA, full screen/sheet disposition and route-state
   ownership without deleting capabilities.
4. **Phases 4–6:** consolidate journeys and truth/account/native-fit states in the reference, then
   freeze one owner-approved design commit.
5. **Phases 7–10:** port those contracts faithfully into `apps/mobile`, completing Personal first,
   then connected account/provider/entitlement work and the gated Business beta.
6. **Phase 11:** complete authored Melo art and native host integration in parallel where safe.
7. **Phase 12:** close all locally actionable verification, then the hardware/account/reviewer/store
   gates as those resources become available.

## Completed checkpoint record

| Commit    | Bounded checkpoint only                                                                                       |
| --------- | ------------------------------------------------------------------------------------------------------------- |
| `907ee8b` | Ten accepted advisor safety/authority plans completed and published                                           |
| `8082bdd` | Android recovery, deletion, billing/startup/accessibility diagnostics and local signed release lane hardened  |
| `3ffd95d` | Melo dismissal-policy tests made deterministic through an injectable evaluation clock                         |
| `abb03a0` | GBP-only launch boundary enforced across account, intake, provider and canonical money paths                  |
| `e18e7d3` | Account lifecycle, exclusion, credit, overdraft and card-payment money boundaries enforced and tested         |
| `a9b6dfd` | Transaction lifecycle, correction relationships, analytics, persistence and audit truth enforced and tested   |
| `05089ec` | Unified transaction detail, exact splits, linked refunds/transfers/reversals and persistence/export completed |
| `04f2e9c` | Versioned England/Wales bank-holiday and truthful early-payday projection completed                           |
| `d2a35ca` | Native Money Sources consolidation and honest bank consent/freshness lifecycle completed                      |
| `3ee0d51` | Money Sources account management and bank-holiday-aware income cadence completed                              |
| `6b5159f` | Privacy-bounded intake history, duplicate/failure/retry truth and saved-evidence viewer completed             |
| `d7c3fa6` | Reusable worked-out number surface completed for Personal Safe Range and Business runway                      |
| `c714c38` | Personal and Business Review consolidated across Check, Activity, Decisions and Sources                       |
| `6f965db` | Adjust Path consolidated across Preview, Resolve, Recovery and saved decisions                                |

This table will grow as work lands. It must never replace the programme-status table above.
