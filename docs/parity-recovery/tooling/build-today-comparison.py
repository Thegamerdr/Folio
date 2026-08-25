"""Build deterministic same-viewport Today comparison artifacts."""

from __future__ import annotations

import json
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFont, ImageStat


ROOT = Path(__file__).resolve().parents[3]
SOURCE = ROOT / "docs/parity-recovery/evidence/design/ad90b4/safe/light/today/source-phone-frame-438x900.png"
NATIVE = ROOT / "docs/parity-recovery/evidence/native/harness-07c2e31/confirmed-safe/light/today/native-full.png"
OUT = ROOT / "docs/parity-recovery/evidence/comparisons/07c2e31/today-light"
VIEWPORT = (360, 668)


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    source_frame = Image.open(SOURCE).convert("RGB")
    native_full = Image.open(NATIVE).convert("RGB")

    # Pinned source phone's paper viewport inside the design-review bezel.
    source = source_frame.crop((14, 84, 364, 826)).resize(VIEWPORT, Image.Resampling.LANCZOS)
    # S9 product viewport: 1080x2004 physical pixels = 360x668 logical pixels.
    native = native_full.crop((0, 72, 1080, 2076)).resize(VIEWPORT, Image.Resampling.LANCZOS)

    source.save(OUT / "source-360x668.png")
    native.save(OUT / "native-360x668.png")
    Image.blend(source, native, 0.5).save(OUT / "overlay-50.png")

    diff = ImageChops.difference(source, native)
    diff.save(OUT / "absolute-diff.png")
    stat = ImageStat.Stat(diff)
    mean_abs = sum(stat.mean) / 3
    rms = (sum(value * value for value in stat.rms) / 3) ** 0.5

    label_h = 32
    sheet = Image.new("RGB", (VIEWPORT[0] * 2, VIEWPORT[1] + label_h), "#f6f4ee")
    sheet.paste(source, (0, label_h))
    sheet.paste(native, (VIEWPORT[0], label_h))
    draw = ImageDraw.Draw(sheet)
    font = ImageFont.load_default()
    draw.text((12, 10), "PINNED SOURCE ad90b4 (safe reference)", fill="#1b1815", font=font)
    draw.text((VIEWPORT[0] + 12, 10), "NATIVE 07c2e31 (confirmed-safe)", fill="#1b1815", font=font)
    sheet.save(OUT / "side-by-side.png")

    metrics = {
        "comparison_kind": "structural-reference-not-matched-data",
        "native_fixture": "confirmed-safe",
        "native_sha": "07c2e31",
        "source_pressure_fixture": "safe",
        "source_sha": "ad90b4fee36c58be156e145e8663d8c6be1bf0eb",
        "viewport_logical_px": {"width": 360, "height": 668},
        "mean_absolute_rgb_delta": round(mean_abs, 4),
        "rms_rgb_delta": round(rms, 4),
        "acceptance_eligible": False,
        "reason": "Source and native data fixtures differ; this pair validates structure only.",
    }
    (OUT / "metrics.json").write_text(json.dumps(metrics, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
