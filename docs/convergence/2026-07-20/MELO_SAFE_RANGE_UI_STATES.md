# Melo Safe Range UI states

Today renders the Trusted Safe Range as a compact explanatory card, not a redesign of the whole screen.

## Shared UI content

Every state shows:

- Trusted Safe Range eyebrow;
- headline;
- summary line;
- expected range;
- committed floor;
- tightest point or shortfall;
- confidence;
- freshness;
- source reliance;
- why changed;
- source summary;
- one next action when available.

## States

| Required state | Contract status / signal | User meaning | Primary UI treatment |
|---|---|---|
| Reliable positive range | `ready` | Melo can be relied on for this answer | Positive status tone, no forced action |
| Positive but low-confidence range | `caution` + `confidence: low` | The answer is useful but less certain | Calm caution tone, show reason |
| Aging data | `caution` + `freshness: ageing` | A material source is getting old | Calm caution tone, show freshness |
| Stale data | `stale` | A source is too old | Caution tone, refresh-balance action |
| Missing material information | `insufficient_data` | A material input is missing | Repair tone, no expected range |
| Contradicted sources | `contradicted` | Sources disagree | Repair tone, Review action |
| Shortfall | `shortfall` | Conservative range goes below zero | Repair tone, Recovery action |
| No range available | `expectedRange.basis: unavailable` | Melo cannot defend a range | Repair tone, explain missing/blocking facts |
| Sample/demo mode | `sample_demo` | Demo numbers, not user money | Provisional tone, replace sample action |
| First-session provisional result | `insufficient_data` or `sample_demo` | Melo still needs the user's money picture | Provisional tone, start/account action |
| Data changed since last view | `whyChanged.length > 0` | The answer moved because inputs moved | Show the first three change drivers |
| Calculation error | `insufficient_data` + `forecast_input_invalid` | Forecast input is invalid | Repair tone, no range, name the invalid input |
| Restored-backup recalculation | `caution` + `restored_encrypted_backup` | Restored data is usable but should be checked | Calm caution tone, show restore reason |
| Offline state | Today `state: offline` + local result | The local truth still renders without network | Same card, no spinner |
| Provider outage with usable local truth | `stale` or `caution` from source freshness | Last local truth is usable but less fresh | Show freshness and source reliance |
| Workspace blocked | `workspace_blocked` | Personal adapter received non-Personal data | Repair tone, no expected range |

## Accessibility

- The card has a summary accessibility label containing status and summary.
- The next-action control has `accessibilityRole="button"`.
- The next-action control has `minHeight: 44`.
- The card uses existing theme tokens.
- Reduced-motion behaviour is unchanged because the card adds no motion.
