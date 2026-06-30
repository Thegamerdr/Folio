## UPDATE — 2026-06-30 (evening): items resolved

This is a historical snapshot from 2026-06-23; the body below is unchanged. This section records which of the concerns this scorecard is built to catch were addressed in tonight's work on branch `claude/folio-rn-faithful-port` (commits `eb6e0a0`, `3783c9c`, `a3f81c9`; audit notes in `7147884`). 0 typecheck errors, 306 folio tests green; visible fixes verified on-device by screenshot. Only items the change-list actually covers are marked resolved.

Resolved tonight:

- **"any place where evidence was missing" / fabricated data (affects Trust level, and the Empty First Launch scenario).** Sample and placeholder data was purged so a cleared/real app shows only the user's own data; demo/illustrative data is now gated behind the demo regime (`currentBalance.source==='sample'`). Specifically: the Today money-path chart was hardcoded SVG geometry (the "salary rise +£2,180 / bill drop −£875 / 7 Jul" shape) and now plots from the real `route.points` daily series; the Today summary trio ("Coming in £2,180 / Going out £1,095") and the low-point week tile now read real route totals/tight point; the Calendar agenda's hardcoded "Check Klarna · 2 of 3" review, the generic UK tax deadlines, and `RECURRING_BILLS` (Octopus/Council Tax/Rent/BT) are gated behind the demo regime; the reader screens (Visualizer/Review/Paste/Image), SubCaughtSheet, and edit sheets no longer fall back to sample rows or a fake "Tesco · £42 · 26 Jun" on a cold open — they show honest empty doorways / blank forms; the RouteDetailSheet Octopus/Rent placeholder and the chart "breathing room · £100" label were cleared. (commits `eb6e0a0`, `3783c9c`, `a3f81c9`)
- **Melo mood was a no-op (affects Trust level / Comfort across scenarios).** App-wide pressure is now derived from the real route via `derivePressure()`, gated on a real money picture so an empty/cleared app stays neutral calm; the mood picker sets a global override (`nav.setPressure`) that propagates to Today/What-if/Melo/chat.
- **Invisible text on the dark canvas (affects Clarity / Trust level for the Empty First Launch and money-path screens).** The TimelineScreen headline and subhead had no color bound, defaulted to black, and were invisible on the dark canvas (light mode read fine). They are now bound to the theme ink/muted tokens.
- **"any tap or scroll that felt hard" (Scroll comfort).** Privacy, Subscriptions, PaydayRitual, Check-in, and Start were fixed-height and clipped content below the fold; they are now wrapped in `ScrollView` so content scrolls — including Privacy's "Clear to empty" control, which was previously unreachable.
- **Data Control scenario — "Start fresh" did not start fresh.** More → "Start fresh" called `resetAll`, which reseeded the demo ("it all came back"); it now calls `resetToEmpty` with a one-tap confirm.
- **Import Review scenario — wrong dates.** Imported transactions now keep their real statement date instead of being stamped "today".

Also changed tonight (not a scorecard dimension, recorded for completeness): AI cost split — chat pins the cheaper `gemini-2.5-flash-lite`, vision (`gemini-2.5-flash`) is reserved for PDF/photo extraction, and the gateway model allow-list rejects costlier models. This needs a `wrangler deploy` plus an OpenRouter spend cap to take effect.

Still open (owner/QA, not RN bugs, so untouched by tonight's work):

- An exhaustive per-screen dark-mode and cross-device **visual** pass on an emulator — a token-contrast audit cannot catch a missing color, only looking can, which is how the TimelineScreen issue above survived earlier passes.
- iOS verification (needs a Mac/EAS; unbuildable on the Windows dev box).
- The gateway redeploy and OpenRouter spend cap that the AI cost split depends on.

The scenario table below was never filled in and remains a blank dogfood template; nothing in tonight's change-list fills those rows. The redesign/blocked verdict question is left to the owner's actual dogfood pass.

---

# Android Dogfood Scorecard

Date: 2026-06-23

Use one row per scenario. Keep notes plain and honest.

## Scoring Labels

- Works: works / partial / broken
- Clarity: clear / confusing
- Comfort: comfortable / stressful
- Language: human / too technical
- Touch comfort: good / awkward
- Scroll comfort: good / awkward
- Trust level: high / medium / low

## Scenario Scores

| Scenario                     | Works | Clarity | Comfort | Language | Touch comfort | Scroll comfort | Trust level | Notes |
| ---------------------------- | ----- | ------- | ------- | -------- | ------------- | -------------- | ----------- | ----- |
| 1. Empty First Launch        |       |         |         |          |               |                |             |       |
| 2. Minimal Manual Path       |       |         |         |          |               |                |             |       |
| 3. Import Review             |       |         |         |          |               |                |             |       |
| 4. Duplicate Rejected Import |       |         |         |          |               |                |             |       |
| 5. Recovery Preview          |       |         |         |          |               |                |             |       |
| 6. Data Control              |       |         |         |          |               |                |             |       |
| 7. Offline Use               |       |         |         |          |               |                |             |       |
| 8. Stress / Bad Month        |       |         |         |          |               |                |             |       |

## Final Verdict

Choose one:

- Ready for continued owner dogfood
- Needs fixes before owner dogfood
- Needs redesign before owner dogfood
- Blocked

## Verdict Notes

Record:

- strongest moment;
- most confusing moment;
- most stressful moment;
- any wording that felt advisory, shaming or fake-certain;
- any tap or scroll that felt hard;
- any place where evidence was missing;
- whether you would trust this with a real month of owner data.
