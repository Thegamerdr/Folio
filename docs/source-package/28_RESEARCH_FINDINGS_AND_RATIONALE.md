# Research Findings and Rationale

## Research approach

Research completed on 20 June 2026 prioritised primary sources: platform documentation, UK regulators/government, Open Banking standards, security standards, official software documentation and peer-reviewed behavioral research.

Volatile versions, prices, tax thresholds and store policies must be re-checked immediately before implementation/release.

## Findings translated into design

### Financial outcome

Consumer financial well-being research consistently frames the outcome as day-to-day control, ability to absorb shocks, being on track and freedom of choice. Folio therefore optimises for clarity/confidence rather than a synthetic “health score.”

### Guidance/advice boundary

UK FCA material shows that personalised opinions guiding action, including advice on liquidating consumer-credit debts, can cross regulated boundaries. Folio uses neutral simulation, factual comparison and user-selected rules. Legal review is still required; wording alone is not a complete compliance strategy.

### Local-first

Local-first architecture allows reads/writes without another computer being available. This supports Folio's trust and offline promise. SQLite is appropriate for device-local authoritative state, while sync is an optional layer.

### Security

Financial records and keys require protected local storage, current cryptography, secure network handling and privacy controls. OWASP MASVS provides the mobile verification baseline. Apple Keychain/Secure Enclave and Android Keystore are the appropriate platform roots for key protection.

### Recovery

Platform/account authentication is not equivalent to recovering an end-to-end encrypted vault. Folio therefore separates account authentication from a user-controlled vault recovery mechanism.

### Permissions

Apple/Android guidance favours contextual, just-in-time requests. Folio does not request bank, camera, microphone, notifications or calendar access on first launch.

### Calendar/background execution

Mobile background execution is not exact. Folio stores an internal calendar and schedules local notifications when records change rather than depending on a future precise background wake.

### Open Banking

UK standards group account information into permissions and require explicit, understandable consent. Scope is constrained by bank/provider capabilities. Folio uses a regulated provider adapter initially and exposes consent/revocation state.

### Business/tax

UK MTD requirements began phased mandation in April 2026 and continue to change by threshold/year. Business tax logic must be versioned, sourced and separate. Direct filing requires dedicated HMRC integration/compliance.

### AI

On-device language models are increasingly available but not universal; cloud model pricing and lifecycles change quickly. A provider registry plus deterministic fallback prevents lock-in. Low-cost cloud text at modest usage can remain inexpensive, but documents/audio/grounding require separate budgeting.

### Gamification

Self-determination research supports motivation when experiences strengthen autonomy and competence. Folio rewards real understanding/progress and lets users control the tone; it avoids loss-aversion/guilt mechanics.

### Accessibility/privacy

Mobile platform and WCAG guidance support accessible native controls, large text, screen-reader paths and reduced motion. ICO guidance requires privacy by design and a DPIA where processing is likely high risk. Folio keeps sensitive telemetry local/minimised and makes cloud processing explicit.

### App stores

Apple and Google require accurate privacy/financial declarations and account deletion when accounts exist. Local core without login aligns with user trust and reduces unnecessary collection.

## Chosen architecture versus alternatives

### Chosen: encrypted SQLite authoritative locally

Rejected as default:

- cloud database authoritative: breaks offline/trust promise;
- browser storage: weaker mobile durability/security and not native-first;
- unencrypted local JSON: unsuitable sensitivity/scale;
- model-generated state: non-deterministic and unsafe.

### Chosen: event/fact/expectation separation

Rejected:

- treating recurring bills as transactions before they happen;
- one mutable row that changes from prediction to actual;
- dashboard aggregates without provenance.

### Chosen: typed proposal/review

Rejected:

- agent writes directly to database;
- chat transcript as application state;
- silent auto-categorisation of tax-relevant records.

### Chosen: separate business workspace

Rejected:

- business filter over a mixed ledger;
- combined tax/reporting views;
- shared Melo memory without scope.

### Chosen: optional plans

Rejected:

- compulsory goals/personality questionnaires;
- fixed one-size-fits-all debt journey;
- “failed plan” verdicts.

## Known uncertainties

- Native database/Expo compatibility must be proven by spike.
- Exact cloud sync implementation deserves cryptographic review.
- Advice boundary and business/tax claims require UK legal counsel.
- First-minute entertainment/value needs usability testing, not desk research alone.
- Retention/personalisation must be validated without coercion.
- Open Banking provider quality/cost requires procurement testing.
- Business scope should follow demand while preserving architecture.
