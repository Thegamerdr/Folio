# RN-app Audit

```json
{
  "router": "expo-router (~56.2.11) with experiments.typedRoutes:true. The app/ tree is MINIMAL and NOT idiomatic file-based: only two files exist — app/_layout.tsx and app/index.tsx (no src/navigation dir despite the task hint; it does not exist). _layout.tsx mounts a single Stack (headerShown:false, contentStyle bg = theme canvas) wrapped in ThemeProvider from src/surfaces/pressureMap/kit, and gates first paint on Fraunces fonts via useFonts. ALL navigation is an in-memory state machine, NOT routes: app/index.tsx (FolioHome, 2763 lines) holds `const [screen, setScreen] = useState<Screen>('today')` and switch-renders one of ~25 screens from the Screen union (defined in mobileShell.tsx: ProductScreen = start|today|timeline|calendar|plans|melo|money|import|recovery|more|dogfood|data|pots|subscriptions|insights|ritual|shortfall|whatif|todayAfter, plus firstMinute|quickEstimate|sampleBriefing|foundItems|billFlow|debtFlow|guideFlow). The 4 bottom tabs (kit NAV_TABS: Today/Review(=import)/Melo/More) are buttons that call setScreen, rendered by kit BottomNav. Sheets are RN-Modal/Reanimated overlays toggled by boolean state, NOT router modals. To add screens you either (a) add a case + Screen-union member driven by setScreen inside index.tsx, or (b) — recommended for a self-contained port — register ONE new expo-router route file (e.g. app/folio.tsx) that renders the new self-contained shell independently of FolioHome, so the existing state machine and its surfaces are untouched. app/index.tsx remains the default route; the new tree is reachable by its own route id/deep-link only.",
  "presentPrimitives": [
    "Design kit + tokens + primitives: C:/dev/folio-v2-greenfield/apps/mobile/src/surfaces/pressureMap/kit.tsx (exports paper light palette, ThemeProvider, Eyebrow/Display/Headline/Verdict/HeroMoney/Body/Muted type primitives, PressureScreen/Surface/Hairline layout, PrimaryAction/GhostButton/QuietLink/ChipToggle buttons, MoneyPad keypad, ChevronRight/CheckGlyph SVG glyphs, BottomNav tab bar, money()/magnitude()/poundsLabel() formatters, gap/radius/pressed/elevation tokens, VerdictTone type)",
    "Theme engine (light+dark palettes, useTheme/useIsDark/useThemeMode/makeStyles pattern): C:/dev/folio-v2-greenfield/apps/mobile/src/surfaces/pressureMap/kitTheme.tsx (paperDark, Palette, ThemeMode)",
    "Secondary kit incl. Melo line primitive: C:/dev/folio-v2-greenfield/apps/mobile/src/surfaces/pressureMap/secondaryKit.tsx (MeloLine, MeloTone)",
    "Shared bottom-sheet primitive (RN Modal + Reanimated, NOT @gorhom): C:/dev/folio-v2-greenfield/apps/mobile/src/surfaces/pressureMap/Sheet.tsx (Sheet)",
    "Money path chart primitive: C:/dev/folio-v2-greenfield/apps/mobile/src/surfaces/pressureMap/MoneyPath.tsx",
    "Melo companion + states/mood: C:/dev/folio-v2-greenfield/apps/mobile/src/surfaces/pressureMap/meloCompanion.tsx, .../melo/, .../meloPressure.ts",
    "Canonical money formatter (single source, used by kit.money): formatMinorAmount in C:/dev/folio-v2-greenfield/apps/mobile/src/local/localLedger.ts",
    "Design tokens package (hex/spacing source of truth, re-mirrored by kit.paper): C:/dev/folio-v2-greenfield/packages/ui/src/tokens.ts via @folio/ui (folioTokens)",
    "Brand mark: C:/dev/folio-v2-greenfield/apps/mobile/src/surfaces/brandMark.tsx (FolioBrandMark)",
    "Count-up animation hook: C:/dev/folio-v2-greenfield/apps/mobile/src/surfaces/pressureMap/useCountUp.ts",
    "Reduced-motion hook: useReducedMotionPreference exported from C:/dev/folio-v2-greenfield/apps/mobile/src/surfaces/mobileShell.tsx"
  ],
  "enginePackages": [
    "@folio/finance-engine (packages/finance-engine, single index.ts barrel) — money-path / cycle / payday-clamp math core",
    "@folio/plan-engine (packages/plan-engine) — plans/commitments + what-if scenarios",
    "@folio/today-engine (packages/today-engine) — Today derivations",
    "@folio/calendar-engine (packages/calendar-engine) — calendar timeline + ICS feed engine (ics referenced in 13 files)",
    "@folio/import-engine (packages/import-engine) — statement/CSV/TSV/paste import + draft review (statement referenced in 42 files, paste in 9)",
    "@folio/domain (packages/domain) — Money + canonical types shared by all engines",
    "@folio/melo-policy (packages/melo-policy) — Melo advisory policy (no direct state mutation)",
    "@folio/open-banking (packages/open-banking) — present but product direction = statement-reader-first, NOT open banking (memory note)",
    "@folio/storage + @folio/sync + @folio/crypto — encrypted local persistence (op-sqlite sqlcipher/fts5)",
    "@folio/first-minute, @folio/store-release, @folio/release-gate, @folio/release-readiness, @folio/policy-packs, @folio/search-engine, @folio/event-engine, @folio/business-workspace, @folio/ai-contracts, @folio/testing — supporting; NOTE the 8 named engines (edit-txn, pot-cadence, payday-clamp, undo-policy, export, import-sheet, sub-signals, hosted-calendar, statement/photo/text readers, money-path, cycle-tracker, insights, store-migration) are NOT standalone packages — they are implemented as concepts inside finance-engine/domain and as adapters under apps/mobile/src/local/ (e.g. recurringChargeDetection.ts=sub-signals, calendarIcs.ts=hosted-calendar ICS, statementExtraction.ts/nativeImageIntake.ts/nativeTextExtraction.ts=statement/photo/text readers, nativeDataExport.ts=export, localInsightsAdapter.ts=insights, canonicalLedgerStore.ts=store-migration, *Adapter.ts wire each engine to the UI)"
  ],
  "depsMissingForComponentMap": [
    "@gorhom/bottom-sheet (NOT installed; app uses custom src/surfaces/pressureMap/Sheet.tsx over RN Modal + react-native-reanimated — a faithful port should reuse Sheet.tsx, not add gorhom)",
    "lucide-react-native (NOT installed; all icons are hand-rolled react-native-svg <Svg><Path/Circle/Line/Rect> glyphs in kit.tsx NavIcon and per-surface — port either reuses these or adds lucide-react-native + react-native-svg only if the web tree depends on lucide names)",
    "expo-haptics (NOT installed and NOT used anywhere in src; add only if the faithful web port calls for haptic feedback)",
    "@shopify/flash-list (NOT installed; lists use RN ScrollView/FlatList)"
  ],
  "depsPresent": [
    "expo ~56.0.12",
    "expo-router ~56.2.11",
    "react 19.2.3",
    "react-native 0.85.3",
    "react-native-svg 15.15.4 (icon system)",
    "react-native-reanimated 4.3.1 (+ react-native-worklets 0.8.3) (Sheet animation)",
    "react-native-gesture-handler ~2.31.1",
    "react-native-safe-area-context ~5.7.0",
    "react-native-screens 4.25.2",
    "@expo-google-fonts/fraunces ^0.4.1 (serif display)",
    "expo-font, expo-image-picker, expo-document-picker, expo-file-system, expo-sharing, expo-secure-store, expo-local-authentication, expo-crypto, expo-linking, expo-splash-screen, expo-status-bar, expo-system-ui",
    "@op-engineering/op-sqlite 17.0.0 (sqlcipher/fts5)",
    "react-native-web ~0.21.0",
    "all @folio/* workspace engine packages"
  ],
  "commands": {
    "typecheck-mobile-app": "pnpm --filter @folio/mobile typecheck   (= tsc -b --pretty false, run from apps/mobile; this is the one that checks app/ + src/ surfaces)",
    "typecheck-root-project-refs": "pnpm typecheck   (root = tsc -b tsconfig.packages.json --pretty false; project refs include ./apps/mobile so this also type-checks the mobile app + all packages)",
    "unit-tests": "pnpm test   (root = vitest run --passWithNoTests; include globs: packages/**/*.test.ts, apps/**/*.test.ts, tooling/**/*.test.ts) — NOTE: only *.test.ts is collected, NOT *.test.tsx; the ~99 suites (HANDOFF says 441 tests) are pure-logic .ts tests, surfaces have NO .test.tsx",
    "single-test-file": "pnpm vitest run apps/mobile/src/local/localLedger.test.ts",
    "lint": "pnpm lint   (root: lint:boundaries + check:v1-boundary + check:samples + check:constitution + check:product-gates + check:operations-readiness + check:store-declarations + check:release-blockers + check:release-foundation + prettier --check . — these are bespoke node gate scripts, NOT eslint)",
    "format-check": "pnpm format:check   (prettier --check .)",
    "ci-all": "pnpm ci   (lint && typecheck && test && validate:contracts)",
    "build-release-apk": "cd apps/mobile/android && gradlew.bat :app:assembleRelease   (alias: pnpm mobile:apk:android -> apps/mobile native:apk:android). Requires env JAVA_HOME=Android Studio jbr, ANDROID_HOME=%LOCALAPPDATA%\\Android\\Sdk. Output: apps/mobile/android/app/build/outputs/apk/release/app-release.apk. Prebuild first if android/ absent: pnpm mobile:prebuild (expo prebuild --clean --no-install)",
    "install-apk-on-emulator-5554": "adb -s emulator-5554 install -r apps/mobile/android/app/build/outputs/apk/release/app-release.apk   (alias: pnpm mobile:install:android -> adb install -r ...)",
    "run-debug-on-emulator-5554": "pnpm mobile:smoke:android   (= expo run:android --variant debug; ensure emulator-5554 is the only/selected device) OR pnpm --filter @folio/mobile android (expo run:android)",
    "metro-dev-server": "pnpm mobile:start   (= expo start)",
    "expo-doctor": "pnpm mobile:doctor"
  },
  "placementRecommendation": "Place the faithful port as a self-contained sibling surface tree at C:/dev/folio-v2-greenfield/apps/mobile/src/folio/ mirroring the web src/components/folio/ layout: src/folio/theme/, src/folio/primitives/, src/folio/screens/, src/folio/sheets/, src/folio/shell/ (FolioShell.tsx owning its own internal screen/tab state machine — the same in-memory pattern app/index.tsx already uses, so no expo-router screen-per-file is required and the typedRoutes graph is untouched). Wire it through expo-router by adding exactly ONE new route file: C:/dev/folio-v2-greenfield/apps/mobile/app/folio.tsx that does `import { FolioShell } from '../src/folio/shell/FolioShell'; export default FolioShell;`. Do NOT touch app/index.tsx, app/_layout.tsx (it already provides ThemeProvider + Fraunces + Stack, which the new route inherits for free), or any file under src/surfaces/pressureMap/ or src/surfaces/mobileShell.tsx. This guarantees the existing pressureMap surfaces and the FolioHome state machine keep working byte-for-byte and remain the default route. Reach the port via deep link folio://folio or by temporarily redirecting index during dogfooding (do not commit a redirect). Critical test-suite safety: the suite only collects *.test.ts (vitest include excludes .tsx) and surfaces ship zero component tests, so adding .tsx UI under src/folio/ cannot break the existing suite; keep any NEW logic tests as pure *.test.ts (engine/adapter level) and do NOT add a DOM/jsdom env or .test.tsx files (none exist today — introducing one would be a new, unconfigured test environment). Reuse, do not fork: import the theme from src/surfaces/pressureMap/kitTheme (useTheme/paper/paperDark/Palette) and formatMinorAmount/canonical mutations from src/local/* so the port shares one palette, one money formatter, and the one canonical engine spine — preventing the data-model and formatting drift the binding spec warns against. For icons reuse the react-native-svg glyph approach already in kit.tsx (no lucide), and reuse Sheet.tsx for modals (no @gorhom). Only add new deps (lucide-react-native, expo-haptics, @gorhom/bottom-sheet) if the web tree's fidelity genuinely requires them; default to the existing primitives. After the port, run pnpm --filter @folio/mobile typecheck, pnpm test, pnpm mobile:apk:android, then install/launch on emulator-5554 to verify nothing in the existing surfaces regressed.",
  "reuseVsBuild": "REUSE (do not rebuild): the theme system (kitTheme.tsx useTheme/paper/paperDark/Palette + makeStyles pattern), the @folio/ui folioTokens hex/spacing source, formatMinorAmount as the single money formatter, the Sheet.tsx bottom-sheet primitive, the react-native-svg icon glyph approach, ThemeProvider+Fraunces font loading in app/_layout.tsx, and ALL of the canonical engine spine — packages/* engines plus apps/mobile/src/local/* adapters and canonicalLedgerMutations/canonicalLedgerStore (the port must drive state through these exact mutation functions, exactly as app/index.tsx does, so the data-model invariant of transaction=posted fact vs future=expectation is preserved). BUILD FRESH (for faithful web fidelity): only the presentation layer under src/folio/ — theme bridge file, primitives that the web tree expects by name, the ported screens, the ported sheets, and the FolioShell container/state-machine — each a thin RN view over the reused engine adapters. Net: ~0% of engine/logic is rewritten (reused), ~100% of the new src/folio/ tree is presentation that maps reused models into the faithful web layout. This matches the established co-work loop in HANDOFF.md (design in Lovable -> port deltas to RN over the in-place engines/tabs/Sheet/kit)."
}
```
