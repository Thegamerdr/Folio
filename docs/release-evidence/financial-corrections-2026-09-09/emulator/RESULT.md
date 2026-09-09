# Emulator supplement: blocked by available storage

The replacement APK could not be installed on `emulator-5554`. This is **not** a pass for replacement-build launch, persistence or offline checks.

- Attempted package: `com.folio.v2.greenfield`, versionCode 2 / versionName 0.0.2.
- Artifact: `Melo-finance-corrected-0.0.2-79367b4c-arm64-x86_64.apk`, 155,795,422 bytes.
- SHA-256 verified locally: `f649bf93aa35a91b6d604032e33397f07dffacbebe0404224ebd67b87cfa474e`.
- `adb -s emulator-5554 install -r --streaming <artifact>` failed: **failed to write; Failed to free 467197098 on storage device at /data**.
- Android's installer log recorded inability to free 622,811,544 bytes, with 221,995,008 bytes finally available. Cache-only trimming had already been attempted. No storage thresholds were changed and no applications, profiles or app data were removed.
- Installed package remained versionCode 1 / versionName 0.0.1. The installed replacement hash therefore cannot be verified, and new-build financial/offline results cannot be claimed.

The documented synthetic profile 10 was visually inspected before installation: Today showed £160 safe, £1,580 starting cash, £950 bills, £200 buffer and 19 days to payday, matching the prior report. No financial values were changed. The meaningful screenshot is `profile10-before-current.png`; it is explicitly an **old-build baseline**.

Restoration verified after the failed install: current Android user **0**, airplane mode **0**, Wi-Fi **1**, mobile data **1**, profile-10 screen timeout **600000**, both storage-threshold settings **null**. Users 0, 10 and 11 still retained the installed app and their existing data. No further install attempts were made. Real Galaxy S9 acceptance belongs to the parent report and was performed independently.
