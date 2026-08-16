# Phase E UI states

## Implemented seams

| Surface                | Phase E state                                                         |
| ---------------------- | --------------------------------------------------------------------- |
| Today What Changed row | reads `materialChanges` first; timeline/import fallback remains       |
| Decision History       | existing receipt surface continues to show entries written by Phase E |
| Recovery               | existing spend-hold confirmation writes a receipt awaiting outcome    |
| Payday Ritual          | existing cycle close writes forecast/accountability receipt           |
| Start / Onboarding     | provisional answer contract exists; dedicated UI is deferred          |
| Review / Edit          | correction impact contract exists; existing edit/review UI remains    |

## Required visual states for next UI pass

- provisional answer
- safe-to-rely answer
- caution/stale answer
- shortfall / pressure answer
- material change before/after
- scenario comparison
- decision receipt
- recovery applied, partial recovery, no action
- payday inside/outside range
- correction before/after
- screen reader status label
- large text
- dark mode
- calculation/storage error
