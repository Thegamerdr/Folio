# Forecast evaluation

Status: deterministic Phase D implementation.

## Stored snapshot

A decision stores a lightweight immutable forecast snapshot:

- forecast version id
- created/calculated time
- horizon start/end
- predicted tightest point
- predicted end position
- predicted safe min/max
- conservative boundary
- confidence
- source fact ids

Safe Range snapshots copy arrays at capture time so later live-state mutation cannot rewrite historical context.

## Evaluation

`evaluateForecast` compares the observed point with the captured range:

| Result          | Meaning                                                                |
| --------------- | ---------------------------------------------------------------------- |
| `inside_range`  | observed value landed between predicted safe min and max               |
| `conservative`  | observed value missed the range but stayed above conservative boundary |
| `outside_range` | observed value breached the conservative boundary or had no safe match |
| `unknown`       | no observable actual was supplied                                      |

No single “Melo accuracy score” exists in Phase D.

## Confidence handling

Evaluation confidence is deterministic from forecast error size:

- <= £5 error: `high`
- <= £25 error: `medium`
- > £25 error: `low`
- no actual: `blocked`

This is local accountability only, not a user score.
