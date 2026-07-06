# NIGHT SHIFT — autonomous overnight program (owner-ordered 2026-07-06)

> **If you are a fresh session (Opus or any model) reading this: you are the relief pilot.**
> Owner directive: "finish everything, not just the 6 phases — night mode, delegate to
> sonnet/opus, if Fable hits its limit Opus fires back up and continues." Check the heartbeat:
> `git -C C:\dev\folio-v2-greenfield\.claude\worktrees\melo-mvp log -1 --format=%cr` — if the
> last commit is **older than ~2 hours** the previous pilot is dead and you take over at
> "EXECUTION LOOP" below. If it's fresh, another session is alive — exit without acting.

## Ground rules (non-negotiable)
- Work ONLY in worktree `C:\dev\folio-v2-greenfield\.claude\worktrees\melo-mvp`, branch
  `claude/melo-mvp`. NEVER switch branches in the main checkout (dirty, different branch).
- Delegate all building to **sonnet** agents via the Workflow tool (batch ≤3 concurrent — the
  API throttle kills ~10-wide fan-outs). You are the orchestrator; keep your own context lean.
- Every phase: build lanes → verify lane (tsc 0 outside src/local + full vitest green) →
  **commit + push** → **OTA publish** → append status line to `DATA_INTELLIGENCE.md` →
  discovery agent (STRICTLY after verify — it races build lanes otherwise) → fix CRITICAL
  discovery findings before the next phase; log HIGH/MED into the backlog section below.
- Review-before-truth is LAW: nothing auto-applies to user money; proposals + confirm sheets.
  Voice: calm, no-shame, never "again" in negative context, max one "!". Copy lint must pass.
- Charter: never touch the ASUS server (192.168.1.108); nothing exposed publicly; no
  credentials entry; C:\dev root stays clean; owner's phone data is sacred — never pm clear.

## Toolchain (this box — every gotcha already paid for)
- tsc: `./node_modules/.bin/tsc -b apps/mobile --pretty false` (ignore src/local errors).
- Tests: `./node_modules/.bin/vitest run apps/mobile` (~1094+) and `packages/melo-engine` (357).
- Commit style: conventional, no attribution footer. Push = plain `git push`.
- OTA (after every phase commit, from `apps/mobile`):
  `npx eas-cli update --channel production --environment production --message "<phase>" --non-interactive`
  (Expo account already logged in machine-level. OTA covers JS-only changes; native/config
  changes need a full APK rebuild — avoid native changes overnight.)
- Native rebuild (only if unavoidable): `subst X: <worktree>` (cleared by reboot — recreate),
  build from `X:\apps\mobile\android` with `$env:JAVA_HOME='C:\Program Files\Android\Android
  Studio\jbr'; $env:ANDROID_HOME="$env:LOCALAPPDATA\Android\Sdk"`; gradlew.bat via PowerShell.
  Phone (2af26a2c19017ece) stays on the debug-signature chain — the upload keystore
  (~/.folio-signing, props in ~/.gradle/gradle.properties) is for Play only. R8 is ON.
- Maestro smoke: `%USERPROFILE%\.maestro-cli\maestro\bin\maestro.bat --device 2af26a2c19017ece
  test apps/mobile/.maestro/smoke.yaml` (needs JAVA_HOME; non-destructive; DON'T run
  first-run.DESTRUCTIVE.yaml on the phone — real data).
- pnpm works in the worktree WITH `--ignore-scripts` only. Config plugins must be `.cjs`.
- Design SoT (READ-ONLY): `C:\dev\folio-melo\.claude\worktrees\design-main`. The web is a
  prototype in places — hardcoded demo strings (like the old frozen date) are parity-BREAK
  candidates, not things to copy.
- Workflow crash resume: `Workflow({scriptPath, resumeFromRunId})` replays completed agents
  from the journal cache. Script files live under the session workflows/scripts dirs.

## PROGRAM STATE (update the checkboxes as you go)
Program spec with all file:line evidence: `DATA_INTELLIGENCE.md` (repo root). Status log at its
bottom — append one line per shipped phase.
- [x] Phase ① income cadence model (shipped + OTA, commit range → 2224ec6)
- [x] Phase ② salary inference + same-income update guard (shipped + OTA, 5c605d3)
- [x] Phase ③ merchant→category memory (shipped + OTA 07-06, flip-threshold hardened)
- [x] Phase ④ historic backfill (shipped + OTA 07-06, TZ/averages/partial-month/retention hardened)
      anchors → cycle boundaries → per-cycle aggregates feeding InsightsScreen month cards +
      CalendarScreen past months), batch-import API, lift the 200-txn cap for imported history
      (source-aware eviction or separate archive slice). Spec in DATA_INTELLIGENCE.md §backfill.
- [ ] Phase ⑤ caught-bills + weekly-cadence unlock: mirror caughtSubs for BILLS, remove the
      monthly-only SHEET_CADENCE filter, confirm-sheet per the SubCaught/IncomeCaught pattern.
- [ ] Phase ⑥ history-fed forecasts: irregular-mode income percentiles (p20-style floor),
      discretionary-spend baselines in projections, bill drift + income drift re-check loops
      (propose-and-confirm "Pay looks different now" sheet), subscription price-rise alerts.
- [ ] Phase ⑦ chunked long-export reading: the 133-page statement answer — client-side page
      ranging or sequential month-window reads with progress UI; keep the 500KB single-shot
      pre-flight as the fallback message. (Real test PDFs in .claude-session/, git-excluded.)
- [ ] Phase ⑧ engine-stack consolidation: multiple parallel engine stacks (melo-engine used
      ONLY by notifications; finance/today/calendar/import-engine packages; folio/lib/*) —
      produce a consolidation plan doc + execute the safe parts (retire dead code paths, one
      source of truth per formula). Careful: notifyState imports melo-engine planNotification.
- [ ] Phase ⑨ backlog burn (see below) + fresh whole-app discovery sweep ("plenty more").
- [ ] Phase ⑩ final: full suites + maestro smoke on device + final OTA + comprehensive owner
      report (what shipped, what's left, deltas vs Lovable) + update memory + this file.

## BACKLOG (non-blocking accumulator — burn in ⑨)
- Income drift re-check (discovery ②-2) — folded into ⑥.
- Benefits/pension credits: income detection is CORRECT behavior; add copy nuance so "pays
  you" reads right for DWP/pension credits (⑥ or ⑨).
- Fallback screens: reader errors now toast, but Pdf/Image fallback screens' own copy is
  generic — could carry the specific reason (⑨).
- Melo notification bridge: journey/milestone/fog notification categories never fire (needs
  full state-machine bridge) — documented scope cut, revisit in ⑧/⑨.
- Timeline 'Ignored' verb unreachable (typed, documented) — fine to leave.
- Transactions/timeline/store caps: revisit holistic retention policy in ④.
- RNTL component render tests blocked by vitest/Flow parse on react-native entry — logic
  tests exist; a vitest-config fix attempt is a ⑨ item, timebox it.
- Play-release gates (owner-side, do NOT attempt): package-id naming, Play Console, privacy
  policy hosting — RELEASE_CHECKLIST.md.

## Succession protocol
- Heartbeat = last commit time on `claude/melo-mvp` (every phase commits; commit even
  mid-phase progress if a phase runs >90min, message `wip(di-...): ...`).
- A Windows scheduled watchdog may launch a fresh Claude session periodically with
  instructions to read this file; if you're that session and the heartbeat is fresh, EXIT.
- On takeover: `git pull` first (a prior pilot may have pushed), read DATA_INTELLIGENCE.md
  status log + this file's checkboxes, check `/workflows`-style task dirs for orphaned runs
  (resume via journal if a phase died mid-flight), then continue the loop.
- Update memory (`C:\Users\User\.claude\projects\C--dev\memory\melo-blueprint-prototype.md`,
  the DI PROGRAM entry) when a phase ships, so even memory-only recovery works.
- When ALL boxes are checked: final report to the owner, mark this file CLOSED at the top.
