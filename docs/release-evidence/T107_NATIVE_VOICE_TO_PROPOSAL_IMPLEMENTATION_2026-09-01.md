# T107 native voice-to-proposal implementation — 2026-09-01

Status: **implemented and non-destructively accepted on the current Android candidate; full
transcript-content, accessibility and iOS acceptance remain.**

## Shipped boundary

- Voice starts only from the visible `Voice` button in `MeloChatSheet`.
- Each tap checks native speech recognition and on-device recognition capability. On-device is
  preferred. If only the phone speech service is available, Melo shows a per-use disclosure before
  asking for platform permission or starting the microphone.
- `Starting microphone`, `Listening`, and `Finishing transcript` are distinct live states. Listening
  uses a high-contrast recording treatment and a visible Stop control.
- Native results enter a separate editable `Review transcript` state. They are never sent
  automatically.
- `Create proposal` sends only the reviewed text into the existing deterministic Melo turn. Any
  financial suggestion remains read-only until the existing separate Confirm button is tapped;
  Dismiss and the 30-second Undo behavior are unchanged.
- Recognition is aborted when the sheet closes, the app backgrounds, or the hook unmounts. It is a
  non-continuous session and does not set `recordingOptions` or an audio-file source, so Melo does not
  retain raw audio.
- Discard clears the transcript draft without creating a chat turn. The adjacent text composer is
  the non-voice alternative.

## Native configuration

- `expo-speech-recognition` is pinned to `56.0.4`, matching Expo SDK 56.
- Android requests `RECORD_AUDIO`; broad external storage and overlay permissions remain blocked.
- iOS includes explicit microphone and speech-recognition usage descriptions.
- Expo Audio background playback and background recording remain disabled.

The implementation follows the package's primary documentation for capability checks,
`requiresOnDeviceRecognition`, permission separation and opt-in recording persistence:
<https://github.com/jamsch/expo-speech-recognition/tree/v56.0.4>.

## Automated evidence

Run on 2026-09-01:

```text
pnpm --filter @folio/mobile typecheck
  PASS

pnpm exec vitest run apps/mobile/app.config.test.ts \
  apps/mobile/src/folio/lib/meloVoiceRecognition.test.ts \
  apps/mobile/src/folio/copy/sourceVoiceLint.test.ts \
  apps/mobile/src/folio/sheets/meloToolSuggestion.test.ts --passWithNoTests
  PASS — 4 files, 37 tests

pnpm --filter @folio/mobile exec expo config --json
  Android permissions: MODIFY_AUDIO_SETTINGS, RECORD_AUDIO
  Android blocked: READ_EXTERNAL_STORAGE, SYSTEM_ALERT_WINDOW, WRITE_EXTERNAL_STORAGE
  iOS microphone description: present
  iOS speech-recognition description: present
```

## Galaxy S9 candidate evidence

The signed 2026-09-01 arm64 candidate was installed with `adb install -r` on the authorized Samsung
Galaxy S9 (`SM-G960F`, Android 10) without clearing or uninstalling the existing app. The following
checks passed:

- the visible Voice entry point opened from Melo;
- because this phone did not offer on-device recognition, Melo displayed its own per-use
  phone-speech-service disclosure before Android requested microphone access;
- Android requested `RECORD_AUDIO` only after the user selected **Start voice** and recorded the
  runtime grant;
- the installed manifest contains `RECORD_AUDIO` and `MODIFY_AUDIO_SETTINGS`, but no background
  audio permission; Expo Audio background playback and recording are disabled in configuration;
- immediately backgrounding Melo after **Start voice** left no active Melo recording in
  `dumpsys audio`; relaunch succeeded and filtered `AndroidRuntime`, `ReactNativeJS` and `libc`
  fatal logs were empty.

Evidence: `s9-2026-09-01-voice-entry.png`, `s9-2026-09-01-voice-consent.png` and
`s9-2026-09-01-voice-permission.png` in this directory.

No transcript-content result is claimed: an automated PC speech attempt was not recognised by the
phone. That row remains a human-spoken acceptance check rather than being converted into synthetic
proof.

## Remaining acceptance evidence

- On Android, record a human-spoken final result → edit → proposal → Dismiss and Confirm/Undo
  path. Repeat the complete flow on iOS hardware.
- Verify sheet dismissal immediately ends the microphone indicator; background cancellation is
  already S9-proven.
- Verify on-device mode on a device with an installed locale and the disclosed phone-service path on
  a device without it.
- Capture TalkBack and VoiceOver announcements/read order. iOS acceptance requires the existing
  macOS/Xcode or EAS device path.
