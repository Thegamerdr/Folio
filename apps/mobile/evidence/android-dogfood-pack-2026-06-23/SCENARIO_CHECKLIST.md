# Scenario Checklist

Date: 2026-06-23

Use this for owner dogfood sessions. Full scenario details live in
`ANDROID_DOGFOOD_SCENARIOS.md`.

| Scenario                     | Status                                        | Evidence                                      | Notes                                                               |
| ---------------------------- | --------------------------------------------- | --------------------------------------------- | ------------------------------------------------------------------- |
| 1. Empty First Launch        | Partially run                                 | `01-clean-first-launch`                       | Clean launch passed; sample persistence remains owner-session item. |
| 2. Minimal Manual Path       | Run                                           | `02` through `07`                             | Save and restart persistence passed.                                |
| 3. Import Review             | Prepared                                      | Root scenarios doc                            | Needs owner manual run with real typing/file.                       |
| 4. Duplicate Rejected Import | Prepared                                      | Root scenarios doc                            | Needs owner manual run after Scenario 3.                            |
| 5. Recovery Preview          | Covered by prior pass, prepared here          | `../recovery-melo-completion-pass-2026-06-23` | Owner should still run it on device.                                |
| 6. Data Control              | Run                                           | `09` through `16`                             | Export, arm clear and clear passed.                                 |
| 7. Offline Use               | Smoke run                                     | `17-offline-today-after-clear`                | Today opens offline; broader owner session still needed.            |
| 8. Stress / Bad Month        | Covered by prior recovery pass, prepared here | `../recovery-melo-completion-pass-2026-06-23` | Owner should score comfort/language.                                |

## Pass/Fail Criteria

Pass dogfood session only if:

- local install succeeds;
- first launch needs no account;
- first launch needs no cloud;
- first launch needs no AI;
- manual facts can create a route;
- saved facts persist after restart;
- import review does not write before confirmation;
- rejected evidence does not affect money;
- recovery preview does not mutate before acceptance;
- accepted recovery creates decision/audit evidence;
- export is available from Data Control;
- clear is deliberate and two-step;
- empty baseline is explicitly not a confirmed zero bank balance;
- no advice, shame or fake-score language appears.

Fail or pause dogfood if:

- APK will not install;
- app cannot launch without Metro;
- app loses saved local state after restart;
- preview writes money before acceptance;
- rejected evidence changes Today;
- Melo writes directly without owner acceptance;
- language feels like advice, shame or fake certainty;
- clear happens without arming;
- any crash appears in logcat.
