# Melo Safe Range confidence

## Truth-class mapping

| Current source | Truth class |
|---|---|
| `user-entered` | `user_confirmed` |
| `corrected` | `user_confirmed` |
| `statement` | `observed` |
| `pdf-derived` | `inferred` |
| `ocr-derived` | `inferred` |
| `sample` | `sample_demo` |

## Freshness thresholds

| Age | Freshness |
|---:|---|
| 0–2 days | `fresh` |
| 3–7 days | `ageing` |
| 8+ days | `stale` |
| missing timestamp | `missing` |

## Confidence levels

| Result condition | Confidence |
|---|---|
| Blocker exists | `blocked` |
| Contradiction | `low` |
| Stale source | `low` |
| Sample data | `low` |
| Caution or shortfall | `medium` |
| Ready with raising reasons only | `high` |

## Confidence reasons

Every result includes machine-readable confidence reasons. Current reason families:

- balance source;
- finance engine used;
- no daily-spend history;
- irregular income cadence;
- multiple paydays;
- missing input;
- contradiction;
- explicit uncertainty;
- restored encrypted backup.

## Reliance

| Status | Reliance |
|---|---|
| `ready` | `safe_to_rely` |
| `caution`, `shortfall`, `stale` | `use_caution` |
| `sample_demo` | `provisional` |
| `insufficient_data`, `contradicted`, `workspace_blocked` | `blocked` |

Only `ready` sets `canUserRelyOnAnswer: true`.
