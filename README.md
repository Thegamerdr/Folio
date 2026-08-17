# Melo

Melo is a local-first personal and business money app with a contextual companion. The sole
shipping application runtime is the React Native app in [`apps/mobile`](apps/mobile); the public
site, design experiments and historical prototypes are supporting surfaces, not parallel apps.

## Setup

Use Node.js 24 and pnpm 11, as pinned in `package.json`.

```powershell
corepack enable
pnpm install --frozen-lockfile
pnpm mobile:start
```

Run the complete repository gate before handing off a change:

```powershell
pnpm run ci
```

## Authority and evidence

- [100% completion execution ledger](docs/convergence/2026-08-17/MELO_100_PERCENT_EXECUTION_LEDGER.md)
- [Current repository and navigation authority](docs/convergence/2026-08-16/MELO_REPOSITORY_AND_NAVIGATION_AUTHORITY.md)
- [Delivery status](STATUS.md)
- [Release evidence index](docs/release-evidence/README.md)
- [Release operations](docs/release-operations/README.md)

Extend this repository and `apps/mobile`; do not create a second Melo repository, product runtime
or app lineage. A completed task, phase contract, test run or platform checkpoint is not completion
of the whole programme; use the execution ledger for the current full-app state.
