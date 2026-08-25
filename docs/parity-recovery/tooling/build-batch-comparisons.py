"""Generate matched comparisons, family contact sheets, and an outlier ledger in bulk."""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[3]
PAIR_SCRIPT = Path(__file__).with_name("build-matched-today-comparison.py")
MATERIAL_PIXEL_DELTA_FLOOR = 2


def parse_batch_filters(values: list[str]) -> set[str]:
    """Parse repeatable, comma-separated batch filters."""
    return {
        batch_id
        for value in values
        for item in value.split(",")
        if (batch_id := item.strip())
    }


def select_batches(
    batches: list[dict[str, object]], requested_ids: set[str]
) -> list[tuple[int, dict[str, object], str]]:
    identified = [
        (index, batch, str(batch.get("id", f"batch-{index + 1}")))
        for index, batch in enumerate(batches)
    ]
    if not requested_ids:
        return identified
    known_ids = {batch_id for _, _, batch_id in identified}
    unknown_ids = sorted(requested_ids - known_ids)
    if unknown_ids:
        raise ValueError(f"Unknown --batch value(s): {', '.join(unknown_ids)}")
    return [row for row in identified if row[2] in requested_ids]


def comparison_metric_values(metrics: dict[str, object]) -> tuple[float, float, str]:
    raw_changed = float(metrics["changedPixelFraction"])
    if "materialChangedPixelFraction" in metrics:
        return raw_changed, float(metrics["materialChangedPixelFraction"]), "material"
    return raw_changed, raw_changed, "raw-legacy-fallback"


def outlier_reasons(
    metrics: dict[str, object], mae_limit: float, rms_limit: float, material_limit: float
) -> list[str]:
    _, material_changed, _ = comparison_metric_values(metrics)
    reasons = []
    if float(metrics["meanAbsoluteRgbDelta"]) > mae_limit:
        reasons.append("mae")
    if float(metrics["rmsRgbDelta"]) > rms_limit:
        reasons.append("rms")
    if material_changed > material_limit:
        reasons.append("material-changed-pixels")
    return reasons


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest", required=True)
    parser.add_argument("--native-ref", required=True)
    parser.add_argument(
        "--batch",
        action="append",
        default=[],
        help="Only process these batch ids; may be repeated or comma-separated.",
    )
    return parser.parse_args()


def font(size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    try:
        return ImageFont.truetype("C:/Windows/Fonts/segoeui.ttf", size)
    except OSError:
        return ImageFont.load_default()


def main() -> None:
    args = parse_args()
    manifest_path = (ROOT / args.manifest).resolve()
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    if manifest.get("schemaVersion") != 1 or not isinstance(manifest.get("batches"), list):
        raise ValueError(f"Unsupported batch manifest: {manifest_path}")

    native_root = ROOT / f"docs/parity-recovery/evidence/native/harness-{args.native_ref}"
    run = json.loads((native_root / "capture-run.json").read_text(encoding="utf-8"))
    apk_by_fixture = {row["fixture"]: row["apkSha256"] for row in run["fixtureRuns"]}
    comparison_root = ROOT / f"docs/parity-recovery/evidence/comparisons/{args.native_ref}"
    thresholds = manifest.get("outlierThresholds", {})
    mae_limit = float(thresholds.get("meanAbsoluteRgbDelta", 16))
    rms_limit = float(thresholds.get("rmsRgbDelta", 52))
    material_changed_limit = float(
        thresholds.get(
            "materialChangedPixelFraction",
            thresholds.get("changedPixelFraction", 0.45),
        )
    )
    requested_batch_ids = parse_batch_filters(args.batch)
    selected_batches = select_batches(manifest["batches"], requested_batch_ids)

    all_rows: list[dict[str, object]] = []
    for batch_index, batch, batch_id in selected_batches:
        fixture = batch["fixture"]
        batch_rows: list[dict[str, object]] = []
        for surface in batch["surfaces"]:
            for theme in surface.get("themes", ["light", "dark"]):
                screen = surface.get("id", surface["screen"])
                subprocess.run(
                    [
                        sys.executable,
                        str(PAIR_SCRIPT),
                        "--native-ref", args.native_ref,
                        "--native-sha", run["nativeSha"],
                        "--apk-sha256", apk_by_fixture[fixture],
                        "--device-id", run["deviceId"],
                        "--fixture", fixture,
                        "--theme", theme,
                        "--screen", screen,
                    ],
                    cwd=ROOT,
                    check=True,
                )
                pair_dir = comparison_root / fixture / theme / screen
                metrics = json.loads((pair_dir / "metrics.json").read_text(encoding="utf-8"))
                source_path = (
                    ROOT
                    / "docs/parity-recovery/evidence/design/ad90b4-matched-v1"
                    / fixture
                    / theme
                    / screen
                    / "source-product-1080x2004.png"
                )
                native_path = (
                    native_root / fixture / theme / screen / "native-product-1080x2004.png"
                )
                native_kind = (
                    "sheet"
                    if surface.get("nativeSheet", surface.get("sheet"))
                    else "screen"
                )
                native_route = (
                    surface.get("nativeSheet", surface.get("sheet"))
                    or surface.get("nativeScreen", surface["screen"])
                )
                native_surface_key = surface.get("nativeStableId") or (
                    f"{native_kind}:{native_route}"
                )
                raw_changed, material_changed, material_metric_source = (
                    comparison_metric_values(metrics)
                )
                reasons = outlier_reasons(
                    metrics, mae_limit, rms_limit, material_changed_limit
                )
                row = {
                    "batchId": batch_id,
                    "fixture": fixture,
                    "screen": screen,
                    "sourceScreen": surface.get("sourceScreen", surface["screen"]),
                    "sourceSheet": surface.get("sourceSheet", surface.get("sheet")),
                    "nativeScreen": surface.get("nativeScreen", surface["screen"]),
                    "nativeSheet": surface.get("nativeSheet", surface.get("sheet")),
                    "nativeKind": native_kind,
                    "nativeRoute": native_route,
                    "nativeStableId": surface.get("nativeStableId"),
                    "nativeSurfaceKey": native_surface_key,
                    "theme": theme,
                    "meanAbsoluteRgbDelta": metrics["meanAbsoluteRgbDelta"],
                    "rmsRgbDelta": metrics["rmsRgbDelta"],
                    "changedPixelFraction": raw_changed,
                    "materialChangedPixelFraction": material_changed,
                    "materialChangedPixelFractionSource": material_metric_source,
                    "outlier": bool(reasons),
                    "outlierReasons": reasons,
                    "source": str(source_path.relative_to(ROOT)).replace("\\", "/"),
                    "native": str(native_path.relative_to(ROOT)).replace("\\", "/"),
                    "overlay": str(
                        (pair_dir / "overlay-50.png").relative_to(ROOT)
                    ).replace("\\", "/"),
                    "difference": str(
                        (pair_dir / "absolute-difference.png").relative_to(ROOT)
                    ).replace("\\", "/"),
                }
                batch_rows.append(row)
                all_rows.append(row)

        contact_dir = comparison_root / "batches" / batch_id
        contact_dir.mkdir(parents=True, exist_ok=True)
        thumb_width, thumb_height, label_height, columns = 270, 501, 42, 4
        rows = (len(batch_rows) + columns - 1) // columns
        sheet = Image.new("RGB", (columns * thumb_width, rows * (thumb_height + label_height)), "#E8E3D8")
        draw = ImageDraw.Draw(sheet)
        label_font = font(18)
        for index, row in enumerate(batch_rows):
            overlay = Image.open(ROOT / str(row["overlay"])).convert("RGB")
            overlay.thumbnail((thumb_width, thumb_height), Image.Resampling.LANCZOS)
            x = (index % columns) * thumb_width
            y = (index // columns) * (thumb_height + label_height)
            sheet.paste(overlay, (x + (thumb_width - overlay.width) // 2, y))
            marker = "OUTLIER · " if row["outlier"] else ""
            draw.text((x + 8, y + thumb_height + 9), f"{marker}{row['theme']} · {row['screen']}", fill="#1B1815", font=label_font)
        sheet.save(contact_dir / "overlay-contact-sheet.png")
        (contact_dir / "ledger.json").write_text(
            json.dumps({"batchId": batch_id, "pairs": batch_rows}, indent=2) + "\n",
            encoding="utf-8",
        )

    ranked = sorted(
        all_rows,
        key=lambda row: (
            float(row["meanAbsoluteRgbDelta"]),
            float(row["rmsRgbDelta"]),
            float(row["materialChangedPixelFraction"]),
            float(row["changedPixelFraction"]),
        ),
        reverse=True,
    )
    ranked = [{**row, "rank": index} for index, row in enumerate(ranked, start=1)]
    ledger = {
        "schemaVersion": 1,
        "nativeSha": run["nativeSha"],
        "nativeRef": args.native_ref,
        "pairCount": len(all_rows),
        "surfaceCount": len({(row["fixture"], row["screen"]) for row in all_rows}),
        "directSurfaceCount": len({row["nativeSurfaceKey"] for row in all_rows}),
        "directSurfaceKeys": sorted({row["nativeSurfaceKey"] for row in all_rows}),
        "outlierCount": sum(1 for row in all_rows if row["outlier"]),
        "thresholds": {
            "meanAbsoluteRgbDelta": mae_limit,
            "rmsRgbDelta": rms_limit,
            "materialChangedPixelFraction": material_changed_limit,
            "materialPixelDeltaFloor": MATERIAL_PIXEL_DELTA_FLOOR,
            "legacyChangedPixelFractionFallback": material_changed_limit,
        },
        "rankedPairs": ranked,
    }
    (comparison_root / "batch-ledger.json").write_text(
        json.dumps(ledger, indent=2) + "\n", encoding="utf-8"
    )
    print(
        f"Batch comparisons complete: {ledger['surfaceCount']} surfaces, "
        f"{ledger['pairCount']} pairs, {ledger['outlierCount']} outliers."
    )


if __name__ == "__main__":
    main()
