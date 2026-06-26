# Cold User Usability Rescue Evidence

Date: 2026-06-24

This folder records the cold-user usability rescue pass.

## Contents

- `FULL_APP_USABILITY_AUDIT.md`
- `COLD_USER_TEST_SCRIPT.md`
- `COLD_USER_USABILITY_SCORECARD.md`
- `IA_BEFORE_AFTER.md`
- `FLOW_CAPTURE_MAP.md`
- `SCREENSHOTS_XML.md`
- `BEFORE_AFTER_SCREENSHOTS.md`
- `ISSUES_DEFERRED.md`
- `CI_SUMMARY.md`
- `pages/`
- `screenshots/`
- `xml/`
- `manifest.json`

## Capture Method

HTML and XML states were generated from local mobile models and surface copy. PNG screenshots were captured from those HTML states using Chrome headless.

The rebuilt release APK was installed on the restarted Android emulator and launched once for a native smoke check.

```text
APK: C:\dev\folio-v2-greenfield\apps\mobile\android\app\build\outputs\apk\release\app-release.apk
Size: 69,823,895 bytes
SHA256: 94267019BB624F52A9655FD68EA1069649B71C22F60D8DF3181D4A2732AAA3EC
Device: emulator-5554
Launch focus: com.folio.v2.greenfield/.MainActivity
Native screenshot: screenshots/apk-launch.png
```

## Evidence Status

Static evidence exists for Start, Review, Today, Timeline, Calendar, Plans, Recovery, Data and privacy, Melo, sample/fake data, manual path and import states. Native emulator was restarted before the pass. One rebuilt-APK launch screenshot is included; the remaining screenshots are static model captures rather than live tap recordings.
