# First Trustworthy Answer implementation

Surface: `apps/mobile/src/folio/screens/FirstAnswerScreen.tsx`

Engine seam: `buildProvisionalFirstAnswer` in `apps/mobile/src/folio/lib/criticalJourneys.ts`

Persistence seam: `recordProvisionalAnswer` in `apps/mobile/src/folio/store.ts`

## Entry points

| Entry point                  | Route          |
| ---------------------------- | -------------- |
| Start primary action         | `first-answer` |
| Empty Today first-run action | `first-answer` |
| More > Money path            | `first-answer` |

## Supported bounded questions

- Will my money last until payday?
- Can I afford a specific amount?
- What is making this month tight?
- What information does Melo need before it can answer safely?

## Minimum-input progression

| State                         | Visible treatment                                                            |
| ----------------------------- | ---------------------------------------------------------------------------- |
| No information                | Shows missing balance/payday/income/commitments before relying on an answer  |
| One entered balance           | Labels balance as user-entered and keeps reliance low/blocked where required |
| Balance and payday            | Adds payday horizon without pretending income is verified                    |
| Balance, payday and income    | Recalculates provisional Safe Range and confidence                           |
| Essential commitments present | Shows essentials as user-entered/assumed inputs                              |
| Low confidence                | Shows confidence and reliance explicitly                                     |
| No defensible answer          | Shows missing material inputs instead of a false range                       |
| Shortfall                     | Shows shortfall result from the provisional Safe Range                       |
| Sample/demo mode              | Marks generated help inputs as sample/assumed, not verified facts            |
| Exit without saving           | Leaves normal onboarding state untouched                                     |
| Save into setup               | Writes only confirmed setup fields; provisional entries stay provisional     |
| Recalculation                 | Adds one highest-value missing input and shows why the result changed        |

## Decision Ledger rule

- Viewing or recalculating a provisional answer creates no Decision Ledger entry.
- A receipt is created only when the user confirms a material choice from the answer, such as recording a choice not to spend after an affordability answer.

## Known limits

- The flow is intentionally structured, not generic chat.
- The "add next" helper uses bounded sample values to demonstrate progression; they remain labelled sample/assumed and are not converted into verified facts unless the user saves into setup.
