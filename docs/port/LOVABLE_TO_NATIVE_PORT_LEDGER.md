# Lovable → React Native port ledger

Status: **BATCH 1 ACTIVE — TODAY OPEN**

## Immutable batch pins

- `DESIGN_SOURCE_SHA=ad90b4fee36c58be156e145e8663d8c6be1bf0eb`
- `NATIVE_BASE_SHA=8cf2f9ba2656b6980cca1e58459521de71bb9967`
- `NATIVE_BRANCH=codex/melo-native-ux`
- `IMPLEMENTATION_BRANCH=codex/lovable-native-today-batch1-2026-08-24`
- `IMPLEMENTATION_WORKTREE=C:\dev\melo-native-today-batch1-2026-08-24`

The design source is immutable for this batch. Later Lovable commits are a
separate explicit delta. The dirty source worktree at `C:\dev\melo-native-ux`
must remain unchanged. Folio remains authoritative for product/domain logic,
state, persistence, navigation, privacy/security, and platform integrations.

## Batch 1 surfaces

| surface/state | Lovable source SHA | native implementation | visual parity | behaviour parity | data authority | Light | Dark | native verification | status | notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Today-required visual foundation | `ad90b4fe` | To adjudicate | OPEN | OPEN | Existing native kit | OPEN | OPEN | Not run | NOT STARTED | Only shared roles required by Today are in scope. |
| Today — confirmed / high confidence | `ad90b4fe` | To adjudicate | OPEN | OPEN | Existing native finance/state authorities | OPEN | OPEN | Not run | NOT STARTED | Reading order must be status → answer → decision → money path. |
| Today — provisional / low confidence | `ad90b4fe` | To adjudicate | OPEN | OPEN | Existing native confidence/evidence authority | OPEN | OPEN | Not run | NOT STARTED | Uncertainty must be honest in copy and visual emphasis. |
| Today — safe | `ad90b4fe` | To adjudicate | OPEN | OPEN | Existing native safe-range authority | OPEN | OPEN | Not run | NOT STARTED | Semantic colour only where meaningful. |
| Today — pressured | `ad90b4fe` | To adjudicate | OPEN | OPEN | Existing native safe-range authority | OPEN | OPEN | Not run | NOT STARTED | Preserve the financial answer as first focal point. |
| Today — overspent / negative | `ad90b4fe` | To adjudicate | OPEN | OPEN | Existing native money-path authority | OPEN | OPEN | Not run | NOT STARTED | Long and negative money values must remain composed. |
| Today — sample/demo truth | `ad90b4fe` | To adjudicate | OPEN | OPEN | Existing native sample-mode authority | OPEN | OPEN | Not run | NOT STARTED | Sample presentation must not masquerade as production data. |
| Today hero | `ad90b4fe` | To adjudicate | OPEN | OPEN | Native finance authority | OPEN | OPEN | Not run | NOT STARTED | Qualifier, amount, and unit form one typographic object; no static figure. |
| Today decision/action | `ad90b4fe` | To adjudicate | OPEN | OPEN | Native decision/navigation authority | OPEN | OPEN | Not run | NOT STARTED | One primary money decision with quiet explanation. |
| Today → Tightest → Payday path | `ad90b4fe` | To adjudicate | OPEN | OPEN | Native money-path calculations | OPEN | OPEN | Not run | NOT STARTED | Continuous native graphic; never a generic bar/line chart. |
| Today Melo / first-run primer | `ad90b4fe` | To adjudicate | OPEN | OPEN | Canonical native Melo/lifecycle | OPEN | OPEN | Not run | NOT STARTED | Semantic placement only; no nav overlap or repeat-visit clutter. |

## Non-droppable owner findings

| ID | Today acceptance finding | Status | Evidence / resolution |
| --- | --- | --- | --- |
| TODAY-OWNER-01 | Mode copy must not clip or compress the header. | OPEN | Pending implementation and native render. |
| TODAY-OWNER-02 | Weather/state glyph must not crop. | OPEN | Pending implementation and native render. |
| TODAY-OWNER-03 | Light must feel as premium as Dark. | OPEN | Pending Light/Dark comparison. |
| TODAY-OWNER-04 | Dotted/prototype-link treatment must not return. | OPEN | Pending code and render inspection. |
| TODAY-OWNER-05 | Terracotta must not be sprayed across every interaction. | OPEN | Pending semantic-colour inspection. |
| TODAY-OWNER-06 | Hero metric semantics must be coherent. | OPEN | Pending state verification. |
| TODAY-OWNER-07 | Pending review must not steal the hero unnecessarily. | OPEN | Pending confirmed/provisional verification. |
| TODAY-OWNER-08 | Melo must not float decoratively. | OPEN | Pending placement verification. |
| TODAY-OWNER-09 | Melo must not overlap navigation. | OPEN | Pending SafeArea/tab-clearance render. |
| TODAY-OWNER-10 | Signature path must not become a generic bar chart. | OPEN | Pending path implementation and render. |
| TODAY-OWNER-11 | Financial answer must remain the first focal point. | OPEN | Pending visual acceptance. |
| TODAY-OWNER-12 | Responsive state changes must be intentionally composed, not merely fit. | OPEN | Pending small/normal/tall render comparison. |

## Batch boundary

Plan, Calendar, Pots, Subscriptions, Debts, What If, Recovery, Shortfall,
Review, Intake, More/settings, and Business surfaces are excluded except for a
strictly necessary shared primitive change required for Today to compile.
