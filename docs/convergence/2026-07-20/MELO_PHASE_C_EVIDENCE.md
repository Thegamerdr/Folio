# Melo Phase C evidence

## Implemented files

- `packages/domain/src/trustedCore.ts`
- `packages/domain/test/trusted-core.test.ts`
- `apps/mobile/src/folio/lib/trustedSafeRange.ts`
- `apps/mobile/src/folio/lib/trustedSafeRange.test.ts`
- `apps/mobile/src/folio/screens/TodayScreen.tsx`
- `tooling/phaseBArchitecture.test.ts`
- `tooling/phaseCArchitecture.test.ts`

## Scenario coverage

The adapter test suite covers:

- complete fresh data;
- user-entered balance;
- statement-derived balance;
- sample/demo balance;
- missing balance;
- missing payday;
- missing income;
- missing material bill;
- stale source;
- estimated variable bill;
- irregular income;
- contradicted balance sources;
- contradicted recurring obligation;
- pending review candidates;
- active debt minimum payments;
- pots reducing spendable cash;
- borrowed pot funds;
- What If holds;
- Recovery hold;
- negative expected range;
- imminent shortfall;
- no daily-spend history;
- multiple paydays;
- weekend payday adjustment;
- calendar-date overflow;
- income after tight point;
- pending refund;
- transfer excluded;
- legacy Safe Zone migrated;
- restored encrypted backup;
- old schema missing truth metadata;
- Business workspace accidentally passed;
- data materially changing during calculation;
- empty new-user state;
- calculation error from malformed forecast input.

## Verification completed during implementation

```text
pnpm test -- apps/mobile/src/folio/lib/trustedSafeRange.test.ts packages/domain/test/trusted-core.test.ts
2 files passed, 42 tests passed
```

```text
pnpm test -- apps/mobile/src/folio/lib/trustedSafeRange.test.ts packages/domain/test/trusted-core.test.ts tooling/phaseCArchitecture.test.ts
3 files passed, 46 tests passed
```

```text
pnpm test
230 files passed, 2644 tests passed
```

```text
pnpm typecheck
passed
```

```text
pnpm build
passed
```

## Device evidence

Representative device evidence is blocked in this Windows workspace because the Android platform tool is unavailable and iOS cannot be run here.

```text
pnpm --filter @folio/mobile exec expo --version
56.1.20
```

```text
adb devices
adb : The term 'adb' is not recognized as the name of a cmdlet, function, script file, or operable program.
```

The automated evidence above verifies deterministic adapter behaviour, boundary rules, TypeScript contracts and build health. A physical or emulator pass remains required for final visual layout, screen-reader readout and Today scroll ergonomics.
