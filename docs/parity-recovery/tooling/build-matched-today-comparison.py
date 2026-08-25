"""Build an unscaled, data-matched S9 surface comparison artifact set."""

from __future__ import annotations

import argparse
import json
import re
from datetime import date
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFont, ImageStat


ROOT = Path(__file__).resolve().parents[3]
SOURCE_SHA = "ad90b4fee36c58be156e145e8663d8c6be1bf0eb"
PRODUCT_SIZE = (1080, 2004)
NATIVE_PRODUCT_CROP = (0, 72, 1080, 2076)


def load_font(size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    try:
        return ImageFont.truetype("C:/Windows/Fonts/segoeui.ttf", size)
    except OSError:
        return ImageFont.load_default()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Build an unscaled, matched-fixture surface comparison."
    )
    parser.add_argument(
        "--native-ref",
        required=True,
        help="Short native commit used in the evidence directory and image label.",
    )
    parser.add_argument(
        "--native-sha", required=True, help="Full native commit baked into the capture APK."
    )
    parser.add_argument(
        "--apk-sha256",
        required=True,
        help="SHA-256 of the exact capture APK installed for this screenshot.",
    )
    parser.add_argument("--device-id", default="emulator-5570")
    parser.add_argument("--fixture", default="confirmed-safe")
    parser.add_argument("--theme", choices=("light", "dark"), default="light")
    parser.add_argument("--screen", default="today")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    if re.fullmatch(r"[0-9a-fA-F]{64}", args.apk_sha256) is None:
        raise ValueError("--apk-sha256 must contain exactly 64 hexadecimal characters.")
    source_path = (
        ROOT
        / "docs/parity-recovery/evidence/design/ad90b4-matched-v1"
        / args.fixture
        / args.theme
        / args.screen
        / "source-product-1080x2004.png"
    )
    source_metadata_path = source_path.parent / "metadata.json"
    native_dir = (
        ROOT
        / f"docs/parity-recovery/evidence/native/harness-{args.native_ref}"
        / args.fixture
        / args.theme
        / args.screen
    )
    native_full_path = native_dir / "native-full-1080x2220.png"
    native_product_path = native_dir / "native-product-1080x2004.png"
    out = (
        ROOT
        / f"docs/parity-recovery/evidence/comparisons/{args.native_ref}"
        / args.fixture
        / args.theme
        / args.screen
    )
    out.mkdir(parents=True, exist_ok=True)
    native_dir.mkdir(parents=True, exist_ok=True)
    source = Image.open(source_path).convert("RGB")
    source_metadata = json.loads(source_metadata_path.read_text(encoding="utf-8"))
    native_full = Image.open(native_full_path).convert("RGB")
    if source.size != PRODUCT_SIZE:
        raise ValueError(f"Source is {source.size}, expected {PRODUCT_SIZE}; refusing to resize.")
    if native_full.size != (1080, 2220):
        raise ValueError(f"Native full capture is {native_full.size}, expected (1080, 2220).")
    native = native_full.crop(NATIVE_PRODUCT_CROP)
    if native.size != PRODUCT_SIZE:
        raise ValueError(f"Native product crop is {native.size}, expected {PRODUCT_SIZE}.")
    native.save(native_product_path)

    overlay = Image.blend(source, native, 0.5)
    overlay.save(out / "overlay-50.png")
    difference = ImageChops.difference(source, native)
    difference.save(out / "absolute-difference.png")

    label_height = 72
    side = Image.new("RGB", (PRODUCT_SIZE[0] * 2, PRODUCT_SIZE[1] + label_height), "#e8e3d8")
    side.paste(source, (0, label_height))
    side.paste(native, (PRODUCT_SIZE[0], label_height))
    draw = ImageDraw.Draw(side)
    font = load_font(28)
    draw.text(
        (28, 18),
        f"PINNED SOURCE · ad90b4 · matched {args.fixture}",
        fill="#1b1815",
        font=font,
    )
    draw.text(
        (PRODUCT_SIZE[0] + 28, 18),
        f"REACT NATIVE · {args.native_ref} · {args.device_id} · S9 viewport",
        fill="#1b1815",
        font=font,
    )
    side.save(out / "side-by-side.png")

    stat = ImageStat.Stat(difference)
    mean_abs = sum(stat.mean) / 3
    rms = (sum(value * value for value in stat.rms) / 3) ** 0.5
    grayscale = difference.convert("L")
    histogram = grayscale.histogram()
    changed_pixels = sum(histogram[1:])
    total_pixels = PRODUCT_SIZE[0] * PRODUCT_SIZE[1]
    source_engine = source_metadata["engine"]
    source_state = source_engine["state"]
    source_route = source_engine["route"]
    personal_engine = isinstance(source_route, dict) and "balance" in source_state
    if personal_engine:
        payday_event = next(
            (event for event in source_engine["events"] if event["source"] == "payday"), None
        )
        payday_date = payday_event["date"] if payday_event is not None else None
        days_to_payday = (
            (date.fromisoformat(payday_date) - date.fromisoformat("2026-08-18")).days
            if payday_date is not None
            else None
        )
        engine_invariants = {
            "todayBalance": source_state["balance"]["amount"],
            "tightestAmount": source_route["tightestSpare"],
            "tightestDate": source_route["tightestDate"],
            "daysToPayday": days_to_payday,
            "paydayAmount": (
                source_route["spareByDay"].get(payday_date)
                if payday_date is not None
                else None
            ),
        }
    else:
        engine_invariants = {
            "businessState": source_state.get("businessState"),
            "persistedBusinessState": source_state.get("persistedBusinessState"),
        }
    metadata = {
        "comparisonKind": "matched-data-calibration",
        "status": "visual-parity-differences-remain",
        "acceptanceEvidenceEligible": True,
        "fixtureId": args.fixture,
        "theme": args.theme,
        "screen": args.screen,
        "fixtureSchemaVersion": 1,
        "sourceSha": SOURCE_SHA,
        "nativeSha": args.native_sha,
        "captureApkSha256": args.apk_sha256.upper(),
        "captureDeviceId": args.device_id,
        "fixedNow": "2026-08-18T08:00:00.000Z",
        "locale": "en-GB",
        "timeZone": "UTC",
        "productViewportPhysicalPx": {"width": 1080, "height": 2004},
        "productViewportLogicalDp": {"width": 360, "height": 668},
        "sourceWasResized": False,
        "nativeWasResized": False,
        "nativeProductCropInFullPx": {
            "left": 0,
            "top": 72,
            "right": 1080,
            "bottom": 2076,
        },
        "meanAbsoluteRgbDelta": round(mean_abs, 4),
        "rmsRgbDelta": round(rms, 4),
        "changedPixelFraction": round(changed_pixels / total_pixels, 6),
        "nonZeroDiffBoundingBoxPx": difference.getbbox(),
        "engineInvariants": engine_invariants,
        "interpretation": (
            "This is valid unscaled matched-state evidence. The metrics quantify the current "
            "native-versus-source output; the pair is not an automatic parity pass, and unresolved "
            "visual differences remain subject to calibration and owner review."
        ),
    }
    (out / "metrics.json").write_text(json.dumps(metadata, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
