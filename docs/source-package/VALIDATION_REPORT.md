# Folio V2 Greenfield Package — Validation Report

**Validated:** 20 June 2026  
**Result:** PASS  
**Structural errors:** 0  
**Warnings:** 0

## Package measurements

- Files: 75
- UTF-8/text lines: 15,681
- Approximate text words: 69,277
- Consolidated master-plan words: 24,367
- SQLite tables/virtual-table internals: 74
- Implementation tasks: 192
- Registered risks: 32
- Research sources: 51
- Forecast vectors: 18
- Import vectors: 15
- Independently recomputed fixture cases: 14

## Validation performed

### File/package integrity

- required files exist;
- no empty files;
- text contracts are UTF-8;
- manifest generated;
- SHA-256 checksums generated for static package files;
- final ZIP member count and CRC verified after packaging.

### Machine-readable contracts

- all JSON files parsed;
- domain JSON Schema passed Draft 2020-12 meta-schema validation;
- OpenAPI YAML parsed as 3.1.0 with 11 paths;
- `database.sql` compiled in an in-memory SQLite database;
- FTS5 virtual search table detected;
- required core tables detected.

### Backlog/research integrity

- task IDs are unique and sequential;
- every task dependency points to an earlier existing task;
- risk IDs are unique;
- research IDs are unique;
- all registered research URLs use HTTPS.

### Financial/import fixtures

- forecast and import fixture IDs are unique;
- all fixtures contain expected outcomes or variants;
- independent arithmetic checks passed for balances, transfers, actual-versus-expected variance, uncertainty exclusion, protected floors, FX, DST, budget rollover, reversals, intraperiod minima and hypothetical isolation.

## Deliberate limitations

This validates the planning artifact and fixture consistency. It does not claim that an application has been implemented, that native encryption works on target devices, or that legal/regulatory review has been completed. Those are explicit implementation and release gates in the plan.

## Re-run

From the package root:

```bash
python testing/validate_package.py
python testing/validate_fixture_consistency.py
```
