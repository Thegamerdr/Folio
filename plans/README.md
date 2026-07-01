# Improve backlog — `claude/folio-web-parity` branch audit

Written against commit `e52de55`. Branch audit (`/improve branch`) of the full web→RN parity
work (88 files, +11.9k). All findings are **introduced** by this branch unless tagged otherwise.
Verification gates for every item: `pnpm --filter @folio/mobile run typecheck` and
`pnpm --filter @folio/mobile exec vitest run` (suite currently 441 green).

## Already fixed in this branch (not plans — done)

- **Melo privacy copy was false** — the "Let Melo see my money" toggle said _"Stays on this
  device"_ while it sends the snapshot to an external AI provider, and defaulted ON.
  Fixed in `e52de55`: default OFF (opt-in), honest copy, and the `apiKey` comment corrected
  (`EXPO_PUBLIC_*` is inlined into the bundle, not "never bundled").

## Audit verdict

The engine layer (Pots/Subscriptions/Cycles via the canonical spine) is **clean** — immutable,
money-safe (minor units, guarded), backward-compatible persistence, and directly unit-tested in
`apps/mobile/src/local/dataEngineModels.test.ts`. No data-loss or critical correctness bugs. The
remaining items are UX/a11y polish, Melo-chat hardening, and one product decision.

## Backlog (leverage-ranked)

| #   | Finding                                                                                                                        | Cat                   | Evidence                                                           | Effort | Leverage     |
| --- | ------------------------------------------------------------------------------------------------------------------------------ | --------------------- | ------------------------------------------------------------------ | ------ | ------------ |
| 01  | `useCountUp` on Pots ignores reduced-motion (Subscriptions honors it); 3 duplicated copies                                     | a11y / dedup          | `pots.tsx` ~73, `subscriptions.tsx` ~56, `todayPath.tsx` ~55       | S      | HIGH         |
| 02  | Reallocation sheet primes state **during render** (anti-pattern; stale-flash under React 18 strict/concurrent)                 | correctness           | `pots.tsx` ~346–352                                                | S      | HIGH         |
| 03  | Buffer-pot tight-point preview keys off a **regex on the pot name** — silently no-ops for off-name pots                        | product / correctness | `pots.tsx` ~59–62                                                  | M      | MED-HIGH     |
| 04  | Insights SVG bar chart has no accessibility role/label — invisible to screen readers                                           | a11y                  | `insights.tsx` ~65–77                                              | M      | MED          |
| 05  | Melo chat: no message length cap / rate limit (prompt-injection surface; advisory arch limits blast radius)                    | security              | `meloChat.tsx` ~112, `meloAiClient.ts` ~187                        | S      | MED          |
| 06  | Melo chat: no request timeout/abort on the provider fetch                                                                      | reliability           | `meloAiClient.ts` ~196, `app/index.tsx` ~733                       | S      | MED          |
| 07  | LLM response parsed with regex + `JSON.parse`, no schema validation (defensive defaults + downstream `VALID_TOOL_NAMES` exist) | security              | `meloAiClient.ts` ~248–303                                         | S      | MED          |
| 08  | No unit tests for `meloAiClient` / `meloChat` (parse, suggestion-validation, error, share-gating)                              | tests                 | `meloAiClient.ts`, `sheets/meloChat.tsx`                           | L      | MED          |
| 09  | Two Melo suggestions are no-ops (remove-spend, tight-point goal) — no canonical mutation; either implement or drop the chip    | product               | `app/index.tsx` suggestion handler                                 | M      | MED          |
| 10  | Hardcoded `rgba(...)` instead of kit tokens (drifts if `paper.calm` changes)                                                   | polish                | `subscriptions.tsx` ~459, `insights.tsx` ~52, `MoneyPath.tsx` ~774 | S      | LOW          |
| 11  | Insights chart bar `key` includes array index (flicker on window switch)                                                       | correctness           | `insights.tsx` ~65                                                 | S      | LOW          |
| 12  | `TodaySpendStrip` returns `null` on empty week (inconsistent with `TodayRecentTxns` empty state)                               | UX                    | `todaySpendStrip.tsx` ~53                                          | S      | LOW          |
| 13  | `headerHint` muted text may fail WCAG AA contrast on inset bg                                                                  | a11y                  | `todaySpendStrip.tsx` ~110                                         | S      | LOW (verify) |

## Owner decision (not a bug)

- **Melo AI key delivery.** A standalone Expo client can only read `EXPO_PUBLIC_*` (bundled/
  extractable). For a real secret, route Melo through a backend proxy that holds the key; for a
  self-hosted/low-value provider, the bundled key is acceptable. Decide before wiring a real key.

## Considered and rejected (don't re-audit)

- valueScore ÷0 → Infinity (intentional "worst", handled in label); Insights avg over empty set
  → 0 (correct); pot progress on zero goal → 1.0 (guarded); JSON-blob persistence for the new
  containers (intentional, no ACID need); count-up models rebuilt per state change (memoized,
  small N); cert pinning (platform TLS sufficient for an operator-configured endpoint); base
  URL / model name bundling (not secrets).

## Suggested order

01 → 02 (quick correctness/a11y), then 05–07 (Melo hardening, bundle as one), then 03/04/09
(MED), then 10–13 polish. 08 (tests) can land anytime and de-risks 05–07. Each is independent;
no hard dependencies. Run `/improve plan <#>` to expand any line into a full executable plan.
