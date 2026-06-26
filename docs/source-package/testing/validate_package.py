#!/usr/bin/env python3
"""Validate the Folio V2 planning package. Standard library plus PyYAML/jsonschema when present."""
from __future__ import annotations

import csv
import hashlib
import json
import re
import sqlite3
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ERRORS: list[str] = []
WARNINGS: list[str] = []


def error(message: str) -> None:
    ERRORS.append(message)


def warning(message: str) -> None:
    WARNINGS.append(message)


def load_json(path: Path):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception as exc:
        error(f"JSON invalid: {path.relative_to(ROOT)}: {exc}")
        return None


def validate_json_files() -> None:
    for path in sorted(ROOT.rglob("*.json")):
        load_json(path)
    schema_path = ROOT / "schemas/domain.schema.json"
    try:
        import jsonschema  # type: ignore
        schema = json.loads(schema_path.read_text(encoding="utf-8"))
        jsonschema.Draft202012Validator.check_schema(schema)
    except ImportError:
        warning("jsonschema not installed; syntax checked but meta-schema not checked")
    except Exception as exc:
        error(f"Domain JSON schema invalid: {exc}")


def validate_yaml() -> None:
    path = ROOT / "schemas/openapi.yaml"
    try:
        import yaml  # type: ignore
        obj = yaml.safe_load(path.read_text(encoding="utf-8"))
        if obj.get("openapi") != "3.1.0":
            error("OpenAPI version must be 3.1.0")
        if not obj.get("paths"):
            error("OpenAPI has no paths")
    except ImportError:
        warning("PyYAML not installed; OpenAPI YAML not parsed")
    except Exception as exc:
        error(f"OpenAPI YAML invalid: {exc}")


def validate_sql() -> int:
    sql = (ROOT / "schemas/database.sql").read_text(encoding="utf-8")
    try:
        conn = sqlite3.connect(":memory:")
        conn.executescript(sql)
        tables = conn.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()
        names = {r[0] for r in tables}
        required = {"workspaces", "transactions", "events", "plans", "calendar_items", "melo_proposals", "audit_log"}
        missing = required - names
        if missing:
            error(f"SQL schema missing required tables: {sorted(missing)}")
        fts = conn.execute("SELECT name FROM sqlite_master WHERE sql LIKE '%fts5%' OR name LIKE '%fts%' OR name='search_index'").fetchall()
        if not fts:
            error("SQL schema has no FTS object")
        conn.close()
        return len(names)
    except Exception as exc:
        error(f"SQL schema failed to compile: {exc}")
        return 0


def expand_dependencies(value: str) -> list[str]:
    out: list[str] = []
    for token in re.split(r"[;, ]+", value.strip()):
        if not token:
            continue
        m = re.fullmatch(r"T(\d{3})-T(\d{3})", token)
        if m:
            a, b = map(int, m.groups())
            out.extend(f"T{i:03d}" for i in range(a, b + 1))
        else:
            out.append(token)
    return out


def validate_backlog() -> tuple[int, int]:
    path = ROOT / "backlog/implementation_backlog.csv"
    with path.open(newline="", encoding="utf-8") as f:
        rows = list(csv.DictReader(f))
    ids = [r["id"] for r in rows]
    if len(ids) != len(set(ids)):
        error("Duplicate task IDs")
    expected = [f"T{i:03d}" for i in range(1, len(rows) + 1)]
    if ids != expected:
        error("Task IDs are not sequential")
    known = set(ids)
    for row in rows:
        for dep in expand_dependencies(row.get("depends_on", "")):
            if dep not in known:
                error(f"Task {row['id']} references missing dependency {dep}")
            elif dep >= row["id"]:
                error(f"Task {row['id']} has non-prior dependency {dep}")
    risks_path = ROOT / "backlog/risk_register.csv"
    with risks_path.open(newline="", encoding="utf-8") as f:
        risks = list(csv.DictReader(f))
    risk_ids = [r["id"] for r in risks]
    if len(risk_ids) != len(set(risk_ids)):
        error("Duplicate risk IDs")
    return len(rows), len(risks)


def validate_sources() -> int:
    path = ROOT / "research/source_register.csv"
    with path.open(newline="", encoding="utf-8") as f:
        rows = list(csv.DictReader(f))
    ids = [r["id"] for r in rows]
    if len(ids) != len(set(ids)):
        error("Duplicate research source IDs")
    for row in rows:
        if not row["url"].startswith("https://"):
            error(f"Non-HTTPS source: {row['id']}")
    return len(rows)


def validate_vectors() -> tuple[int, int]:
    forecast = load_json(ROOT / "testing/forecast_test_vectors.json") or {}
    imports = load_json(ROOT / "testing/import_test_vectors.json") or {}
    fc = forecast.get("cases", [])
    ic = imports.get("cases", [])
    if len({c["id"] for c in fc}) != len(fc):
        error("Duplicate forecast vector IDs")
    if len({c["id"] for c in ic}) != len(ic):
        error("Duplicate import vector IDs")
    for case in fc:
        if "expected" not in case and "variants" not in case:
            error(f"Forecast case missing expected/variants: {case.get('id')}")
    for case in ic:
        if "expected" not in case:
            error(f"Import case missing expected: {case.get('id')}")
    return len(fc), len(ic)



def validate_fixture_consistency() -> None:
    script = ROOT / "testing/validate_fixture_consistency.py"
    try:
        proc = subprocess.run([sys.executable, str(script)], capture_output=True, text=True, check=False)
        if proc.returncode != 0:
            error(f"Fixture consistency validation failed: {proc.stdout or proc.stderr}")
    except Exception as exc:
        error(f"Could not run fixture consistency validation: {exc}")


def validate_files() -> tuple[int, int, int]:
    required = [
        "00_START_HERE.md", "01_GREENFIELD_AGENT_DIRECTIVE.md", "02_PRODUCT_CONSTITUTION.md",
        "25_COMPLETE_BUILD_SEQUENCE_AND_ACCEPTANCE.md", "agent/SINGLE_AGENT_EXECUTION_PROMPT.md",
        "schemas/database.sql", "schemas/openapi.yaml", "testing/forecast_test_vectors.json",
        "FOLIO_V2_GREENFIELD_MASTER_PLAN.md",
    ]
    for rel in required:
        if not (ROOT / rel).exists():
            error(f"Missing required file: {rel}")
    files = [p for p in ROOT.rglob("*") if p.is_file()]
    empty = [p for p in files if p.stat().st_size == 0]
    for p in empty:
        error(f"Empty file: {p.relative_to(ROOT)}")
    text_ext = {".md", ".txt", ".json", ".yaml", ".yml", ".sql", ".csv", ".py"}
    lines = words = 0
    for p in files:
        if p.suffix.lower() in text_ext:
            try:
                text = p.read_text(encoding="utf-8")
                lines += len(text.splitlines())
                words += len(re.findall(r"\b\w+\b", text))
            except UnicodeDecodeError:
                error(f"Non-UTF8 text file: {p.relative_to(ROOT)}")
    return len(files), lines, words


def write_checksums() -> None:
    lines = []
    for p in sorted(ROOT.rglob("*")):
        if not p.is_file() or p.name in {"SHA256SUMS.txt", "VALIDATION_REPORT.md", "MANIFEST.json"}:
            continue
        digest = hashlib.sha256(p.read_bytes()).hexdigest()
        lines.append(f"{digest}  {p.relative_to(ROOT).as_posix()}")
    (ROOT / "SHA256SUMS.txt").write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> int:
    validate_json_files()
    validate_yaml()
    table_count = validate_sql()
    task_count, risk_count = validate_backlog()
    source_count = validate_sources()
    forecast_count, import_count = validate_vectors()
    validate_fixture_consistency()
    file_count, lines, words = validate_files()
    result = {
        "root": str(ROOT),
        "files": file_count,
        "lines": lines,
        "words": words,
        "databaseTables": table_count,
        "tasks": task_count,
        "risks": risk_count,
        "researchSources": source_count,
        "forecastVectors": forecast_count,
        "importVectors": import_count,
        "errors": ERRORS,
        "warnings": WARNINGS,
    }
    print(json.dumps(result, indent=2))
    return 1 if ERRORS else 0


if __name__ == "__main__":
    raise SystemExit(main())
