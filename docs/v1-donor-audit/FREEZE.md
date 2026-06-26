# Folio V1 Freeze

## Freeze identity

- Phase/task: Phase 0 Agent A, T009 V1 reference freeze.
- Source path: `C:\dev\apps\close-ledger-frontend`
- Snapshot path: `C:\dev\folio-v1-freezes\folio-v1-close-ledger-frontend-0.5.2-2026-06-19`
- Source package: `folio-frontend`
- Source version: `0.5.2`
- Freeze created: 2026-06-20 local workspace time.
- Snapshot manifest: `docs/v1-donor-audit/freeze-manifest.csv`

## Source revision

The provided V1 source path is not a Git worktree. `git rev-parse --show-toplevel`, `git rev-parse HEAD`, and `git status --short` all failed with `fatal: not a git repository`.

Because no commit hash is available at the supplied source path, this freeze records package version, release artifacts, file timestamps, read-only state, and SHA-256 hashes for every included snapshot file.

## Snapshot method

The initial copy used `robocopy` from the V1 source path to the external snapshot path. The following material was excluded from the final snapshot:

- `node_modules`
- `dist`
- `release\win-unpacked`
- `release\Folio-0.5.2-ready-pack`
- log files matching `*.log`, `*.err.log`, `*.out.log`, and `*.err`
- any directory named `logs`

After the initial copy, the two release subdirectories above and one remaining `*.err` file were removed from the owned snapshot path because they are part of the requested exclusions. All snapshot files were then marked read-only.

Final snapshot check:

- Files included: 961
- Total bytes included: 885,271,567
- Excluded directory hits: 0
- Log file hits: 0
- Read-only files: 961

## Release/deployment evidence in snapshot

The snapshot includes V1 package/release evidence, excluding the unpacked and ready-pack directories:

- `package.json` version `0.5.2`
- `package-lock.json`
- `release/Folio-0.5.2-android-installable.apk`
- `release/Folio-0.5.2-play-release.aab`
- `release/Folio-0.5.2-portable.exe`
- `release/Folio-0.5.2-ready-pack.zip`
- `release/Folio-0.5.2-ready-pack.zip.sha256`
- `release/Folio-0.5.2-release-ready.md`
- `release/Folio-0.5.2-test-notes.md`

## Greenfield boundary

No V1 runtime source was copied into `apps/`, `packages/`, `services/`, or `infra/` in `C:\dev\folio-v2-greenfield`.

V1 remains a donor/reference product only. Any future reuse must be approved through `docs/v1-donor-audit/inventory.csv` and implemented against a V2 contract after the target V2 module exists.
