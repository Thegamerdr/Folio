# Emulator readiness

Device `emulator-5554`, Android 15 / x86_64. Correct release package: `com.folio.v2.greenfield`. Before replacement: versionCode 1, versionName 0.0.1, installed for users 0, 10 and 11.

User 0 was current on entry and showed empty manual onboarding. Existing release evidence identifies user 10 as the synthetic finance profile; after read-only inspection, this worker switched to that profile. Its existing Today screen visibly showed **£160 safe**, **£1,580 starting cash**, **£1,800 incoming**, **£950 bills**, **£200 buffer**, and **19 days to payday**. This matches the prior release's final synthetic state. No financial values were entered or changed and no app data was cleared or uninstalled.

Original global settings observed: airplane mode 0, Wi-Fi 1, mobile data 1. Original current user: 0. These will be restored after the replacement verification.

QA targeting correction: an initial package-name discovery matched `com.melomoney.app`; that package was queried and launched without financial interaction, then the parent corrected the target to `com.folio.v2.greenfield`. Its generated screenshot/XML files were moved to the current task's scratch work directory and are excluded from acceptance evidence. There were no financial writes, data clearing or settings changes in the other app.

The screenshot `profile10-before-current.png` is the meaningful pre-replacement financial baseline. The initial user-0 splash and onboarding screenshots are readiness observations, not financial acceptance. UIAutomator occasionally failed to acquire an idle/root state; screenshots were inspected directly. A black capture was the emulator display sleeping, confirmed by `dumpsys power`, and is not an app crash.

Storage inspection before install: `/data` is 97% used; 213 MiB initially free. Parent authorized Android's cache-only `pm trim-caches 1G`; after trimming, available space was 216,628 KiB (about 212 MiB). No applications, profiles, databases or app data were removed, and both storage-threshold settings remained `null`. The existing APK occupies approximately 149 MiB. The actual replacement install must determine whether available storage is sufficient.

The profile-10 nonsecure lockscreen was dismissed with Android's normal menu key after wake; no PIN/password was entered. Its screen timeout was read as 600,000 ms and written back to the same value while investigating lockscreen sleep. This did not change the stored setting.
