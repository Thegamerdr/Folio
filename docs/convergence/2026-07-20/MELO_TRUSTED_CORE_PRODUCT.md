# Melo Trusted Core product definition

Status: canonical target for the next execution phase. This supersedes broad "financial OS" ambition for the immediate build, but does not delete long-term vision evidence.

## One-sentence identity

Melo is a private financial decision companion that helps a person understand what is safe now, what is coming, what changed, what remains uncertain, and the next reversible move.

## Primary identity decision

| Candidate identity | Decision | Reason |
| --- | --- | --- |
| Budgeting app | Not primary | Budgets are an input and an optional planning metaphor; Melo's answer is safety and consequence, not envelope compliance. |
| Tracking app | Not primary | Tracking is necessary evidence, but the product should not end at categorisation or charts. |
| Forecasting system | Subordinate | Forecasting is a core engine responsibility, but users experience it as a trusted answer and explanation. |
| Decision system | Primary | The Trusted Core succeeds when a user can make a safer, more informed financial choice. |
| Financial assistant | Subordinate | Melo explains, asks, and proposes; it must not become generic chat or opaque automation. |
| Financial operating system | Deferred long-term ambition | Too broad for the next trustworthy shippable form. |

## Job to be done

When I am unsure whether money is safe to use, or why my situation changed, I want Melo to show the answer with sources, freshness, assumptions, uncertainty, and a reversible next move, so I can act without guessing or feeling judged.

## Target first user

UK personal finance user with variable cashflow or thin margin who needs a local-first, calm answer before spending, moving a bill, handling payday, or recovering from pressure. Business users remain important but are outside the Personal Trusted Core experience.

## First urgent problem

"Can I safely spend or commit to this without breaking something important before payday?"

## What Melo is not

- Not a bank, lender, insurer, investment product, credit broker, tax adviser, or generic AI chatbot.
- Not an engagement game optimised for app opens.
- Not a business bookkeeping product inside the Personal flow.
- Not a product that hides uncertainty to make the UI cleaner.
- Not a product that writes material financial state without informed consent.

## Trusted Core belongs in

- Manual-first onboarding and first trustworthy answer.
- Accounts/current position with source and freshness.
- Income, bills, debts, subscriptions and commitments.
- Review-before-truth for imports, parsing and suggestions.
- Trusted Safe Range, replacing the old single Safe Zone number.
- Calendar derivation and "what changed" explanation.
- Scenarios and one reversible move.
- Recovery and payday/cycle close.
- Correction/provenance and Decision Ledger foundation.
- Export/restore and local-first security.
- Deterministic Melo explanation/tools with explicit confirmation.
- Android production path first.

## Deferred from Trusted Core

- Open Banking as a default route; it can remain gated and optional until live provider proof exists.
- Cloud sync, multi-device, iOS, widgets, voice, partner mode, households, human escalation.
- AI semantic reasoning beyond bounded explanation and missing-information prompts.
- Business tax/filing tools, invoice workflows, and business runway product surfaces.
- Cosmetics and mascot expansion not required for trust.

## Removed from target behaviour

- Silent recurring invoice generation on screen render.
- White or paper text on accent fills.
- Plaintext export files retained in durable document storage after sharing.
- Provider flows that look operational without provider configuration.
- Sample/demo facts appearing as a real user's financial evidence.
- Companion writes outside the confirmation boundary.

## Melo Business boundary

Melo Business is a separate product experience. It may share identity, security, evidence, export, AI policy, design tokens, and truth/provenance infrastructure, but it must not shape Personal navigation or Safe Range semantics. Business-specific surfaces include runway, clients, invoices, obligations, filings, VAT/CT/SA set-aside, business review, and business Melo.

## Must remain shared infrastructure

| Shared foundation | Current evidence |
| --- | --- |
| Design system/tokens | `apps/mobile/src/surfaces/pressureMap/kit.tsx`, `packages/ui/src/tokens.ts`, Lovable `src/styles.css` |
| Local store and persistence bridge until migrated | `apps/mobile/src/folio/store.ts`, `apps/mobile/src/folio/lib/persist.ts`, `packages/storage` |
| Truth/provenance vocabulary | This packet, later domain package |
| Confirmation boundary | `apps/mobile/src/folio/sheets/MeloChatSheet.tsx`, `apps/mobile/src/folio/store.ts` |
| Canonical assets | `apps/mobile/src/folio/assets/canonicalAssets.ts`, `apps/mobile/assets/canonical` |
| Export/restore policy | `apps/mobile/src/folio/lib/export.ts`, `apps/mobile/src/folio/lib/exportNative.ts` |

