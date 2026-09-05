# Lovable review brief

Lovable is the UI/UX authority for this one complete native-app review. Judge the current native
implementation against the existing Lovable source and prescribe exact compact fixes; do not add
features, replace the financial model, or treat implementation evidence as prior visual approval.

Please return one prioritized response covering the full capture pack, with concrete per-screen and
per-file guidance for font sizes/weights, line heights, spacing, safe-area boundaries, card/chart
geometry, companion placement, and keyboard behavior. Prefer existing theme tokens and the smallest
source changes that restore hierarchy and legibility.

Pay particular attention to:

- Today’s crowded date/status area, the large blank chart region, Today/Tightest overlap, and whether
  the chart period visually agrees with the actual payday period.
- The full 35-day tight-point presentation, including the case where the low point is today rather
  than next week.
- Plan, Calendar, More, Account, Search, Debts, Review, Intake, onboarding, chat, transfer/refund,
  and Paywall states across top/scroll/keyboard/denied/offline variants.
- Companion overlap or duplicate-bird rendering, fixed viewport safe areas, and minimum touch targets.

Preserve the existing contracts: local SQL/persistence remains the authority; review precedes posted
financial facts; transfers and refunds remain structural/account-safe; offline and signed-out states
stay truthful. The current evidence is 36 focused checks, a SQLite runtime exercise, and mobile
no-emit TypeScript; there is no physical-device, live-provider, deployed-service, or production-secret
proof. Do not call the product release-ready or reduce these gaps to “all secrets only.”

For each finding, identify the affected source file/screen and the exact token or compact geometry
adjustment, then rank the response by user-visible impact while preserving financial truth.
