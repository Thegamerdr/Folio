# Melo finance behavior matrix — 2026-09-09

The fixed `2026-09-09T12:00:00Z` AppState fixture uses £1,800 cash, £950 dated rent, £70 weekly total essentials, £80 minimum debt payment, £200 buffer and a £380 tight-point floor, with a £320 Klarna balance. `meloReleaseBehaviorMatrix.test.ts` runs 21 focused cases through the real store and canonical projection boundary.

Covered behavior includes lower/higher received-income corrections, rejection of forecast-only correction, dated versus undated new bills, cancellation, unknown/promo APR metadata, arrears and minimum-payment edits, zero/up/down pence-preserving buffer changes, completed debt payment cash delta plus undo, refund pairing, balance-only debt closure, planned extra-payment non-write, stale and ambiguous proposal rejection, monthly-to-weekly essential conversion, deterministic preview figures, and one-off calendar commitments.

Evidence command:

```text
pnpm exec vitest run apps/mobile/src/folio/meloReleaseBehaviorMatrix.test.ts --reporter=dot
```

Result: **21/21 passed**. This is behavior evidence for the finance slice; overall release gates remain owned by the release review.

Late follow-up evidence adds `cash-posting-review-tests.json` (**20/20**) and
`live-cash-lifecycle-tests.json` (**1/1**). The live default-account check verifies a real £120
spend moves cash/safe-to-spend £1,800/£380 → £1,680/£260, a £100 edit survives blob hydration,
and removal restores £1,800/£380. Canonical projection preserves the durable `financialAction`
marker. The original 30 behavior cases remain mapped in the manual-release coverage document;
these checks are additional real-store evidence rather than replacement cases.

The late 0fc4a6f2 device exercise exposed stale £380 after the real spend. Follow-up source work
also closes the rent-pause routing gap and parses “change my rent and bills to £1000” into a
review-only commitment proposal matched to the stored `Rent + bills` row. Signed native verification passed; see manual-release-2026-09-09/DEVICE_ACCEPTANCE.md.
