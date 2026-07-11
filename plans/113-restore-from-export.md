# Plan 113: Restore from a Folio export

> Reviewer-executed (2026-07-11 afternoon wave). Companion to the existing export engine
> (ENGINES §6 "export everything") — closes the loop so an export is an actual recovery
> path, not just an off-ramp.

## Status

- **Priority**: P1 (it is the recovery path the wipe chain's gate 1 already points users at,
  and the prerequisite for ever migrating the owner's phone off debug signing without data loss)
- **Effort**: M
- **Risk**: MED (replaces live state; fully gated by confirm chain + the store's own
  load()/migrate guards)
- **Planned at**: commit `372b0e8`, 2026-07-11

## Why this matters

"Export my data" ships (full AppState JSON + CSVs, free, share sheet) and the destructive
wipe chain tells the user "the export you acknowledged is the real recovery path" — but the
app has NO way to read an export back in. The recovery path is currently a one-way door.
Restore also unblocks: phone signing migration (export → reinstall → restore), device moves,
and honest dogfood resets.

## Design (reuses the battle-tested seams; ~zero new parsing logic)

- The export JSON is the complete `AppState`. The store already has
  `hydrateFromBlob(raw)` (store.ts) which routes any JSON through the SAME `load()` path as
  a cold boot: `migrate()`, the plan-101 Array.isArray guards on every list field,
  `reanchorRenewals`, degraded-load flagging. Restore = validate envelope → `hydrateFromBlob`
  → `consumeLoadDegraded()` → `reconcileEntitlements()`. The running persister
  (`startPersisting`) auto-writes on the resulting `setPartial`.
- New pure engine `lib/restore.ts`: `validateRestoreJson(raw)` (JSON? object? looks like a
  Folio export — ≥2 signature keys?) + `summarizeRestore(parsed)` (counts shown in the
  confirm sheet so the user sees WHAT they are about to load).
- New wrapper `lib/restoreNative.ts`: expo-document-picker → read file → validate → staged;
  `applyRestore(raw)` does hydrate + degraded + entitlements. Mirrors exportNative.ts.
- UI: PrivacyScreen row next to "Export my data". Two-gate Alert confirm (mirrors the
  house pattern): gate 1 shows the file's contents summary + "this replaces everything
  currently in the app" + nudge to export current data first; gate 2 final confirm. On
  apply: plain success Alert; degraded loads say so honestly ("parts of the file couldn't
  be read and were reset — the rest loaded").

## Steps

1. `lib/restore.ts` + `lib/restore.test.ts` (validate: not-json / not-object /
   not-a-folio-export / ok; summarize counts; ROUND-TRIP: `getPersistBlob()` →
   validate+hydrate → state equality on persisted fields).
2. `lib/restoreNative.ts` (picker/read/apply; no tests — thin I/O shell like exportNative).
3. PrivacyScreen: restore row + confirm chain + result alerts. Copy honest, no banned words
   (copyLint runs over screens).
4. Gates: tsc 0, full suite green, prettier. Commit, push.
5. Device: rebuild arm64, install on phone (owner-authorized), export → clear → restore
   drill on the emulator (NOT the phone — never wipe the owner's data).

## STOP conditions

- `hydrateFromBlob`'s silent no-op on malformed input would swallow a restore failure the
  user must see → the wrapper validates BEFORE calling it; if that ordering can't hold, stop.
- Any need to touch store.ts itself (the seams exist; if they don't fit, re-plan).

## Done criteria

- [ ] Round-trip test green: export blob → restore → equal persisted state.
- [ ] Degraded restore surfaces its message (unit-tested via a corrupted list field).
- [ ] Emulator drill: add data → export → clear to empty → restore → data back.
- [ ] tsc 0, full suite green, pushed.
