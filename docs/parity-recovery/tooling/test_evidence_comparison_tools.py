"""Focused tests for matched-comparison metrics and batch adjudication."""

from __future__ import annotations

import importlib.util
import unittest
from pathlib import Path
from types import ModuleType


TOOLING_DIR = Path(__file__).resolve().parent


def load_tool(filename: str, module_name: str) -> ModuleType:
    spec = importlib.util.spec_from_file_location(module_name, TOOLING_DIR / filename)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Unable to load {filename}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


PAIR = load_tool("build-matched-today-comparison.py", "matched_comparison")
BATCH = load_tool("build-batch-comparisons.py", "batch_comparisons")


class MatchedComparisonMetricTests(unittest.TestCase):
    def test_raw_and_material_changed_pixel_fractions_are_distinct(self) -> None:
        histogram = [0] * 256
        for delta in (0, 1, 2, 3, 255):
            histogram[delta] += 1

        raw, material = PAIR.pixel_change_fractions(histogram, 5)

        self.assertEqual(raw, 0.8)
        self.assertEqual(material, 0.4)


class BatchComparisonTests(unittest.TestCase):
    def test_batch_filters_accept_commas_repetition_and_whitespace(self) -> None:
        filters = BATCH.parse_batch_filters(["business, personal", "business", " sheets "])

        self.assertEqual(filters, {"business", "personal", "sheets"})

    def test_material_coverage_controls_gate_while_mae_remains_strict(self) -> None:
        metrics = {
            "meanAbsoluteRgbDelta": 17,
            "rmsRgbDelta": 20,
            "changedPixelFraction": 0.9,
            "materialChangedPixelFraction": 0.4,
        }

        reasons = BATCH.outlier_reasons(metrics, 16, 52, 0.45)

        self.assertEqual(reasons, ["mae"])

    def test_legacy_metrics_fall_back_to_raw_changed_coverage(self) -> None:
        metrics = {
            "meanAbsoluteRgbDelta": 10,
            "rmsRgbDelta": 20,
            "changedPixelFraction": 0.5,
        }

        raw, material, source = BATCH.comparison_metric_values(metrics)
        reasons = BATCH.outlier_reasons(metrics, 16, 52, 0.45)

        self.assertEqual((raw, material, source), (0.5, 0.5, "raw-legacy-fallback"))
        self.assertEqual(reasons, ["material-changed-pixels"])


if __name__ == "__main__":
    unittest.main()
