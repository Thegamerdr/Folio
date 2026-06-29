# MoreScreen  (C:/dev/folio-melo/.claude/worktrees/design-main/src/components/folio/screens/ScreenMore.tsx)

## file

C:/dev/folio-melo/.claude/worktrees/design-main/src/components/folio/screens/ScreenMore.tsx

## rnComponentName

MoreScreen

## purpose

The quiet hub: a single scrollable screen of grouped navigation rows linking to every secondary surface (the picture, tending, trying a move, your data). Pure routing chrome plus two dev/demo actions (Fast-forward 1 month, Start fresh) and an in-app appearance (light/dark) toggle. Holds no money logic. Doc block: @rn-screen MoreScreen, @rn-stack MainTabs > More, @copy FROZEN.

## reads

- theme (light|dark) — web reads document.documentElement.classList; RN reads from a theme store/context useTheme(). Only used to render the Appearance row hint.
- @reads in doc block is — (none); the screen's group data is statically defined in-component.

## writes

- fastForwardMonth() — store action (src/lib/store.ts:564): ages dated state ~30 days, appends a synthetic closed CycleRecord, then nav.go('insights')
- resetAll() — store action (src/lib/store.ts:555): clears state to DEFAULTS with fresh seedTransactions() + empty calendarEvents, then nav.go('start')
- theme toggle — web: document.documentElement.classList add/remove 'dark', localStorage.setItem('folio-theme', next), meta[name=theme-color] swap (#15130F dark / #F7F6F1 light). RN: persist theme to store/AsyncStorage and flip ThemeProvider; NO document/localStorage/meta APIs in RN.

## opensSheets

- share (nav.openSheet('share') from 'Share a cycle')
- onboarding (nav.openSheet('onboarding') from 'Payday & income')

## copyKeys

- Folio (header wordmark / app.name)
- The quiet hub (eyebrow, font-display italic 13px)
- Everything else, calmly. ('calmly' = terracotta accent, <em not-italic text-accent>)
- The picture (group title)
- Timeline / what you added, what you left
- Calendar / the dates that matter
- Plans / what's coming before payday
- Insights / the shape of your months
- Tend the picture (group title)
- Subscriptions / what still earns its place
- Pots / set aside, calmly
- Payday & income / change when money lands
- Payday review / wrap up the month in four steps
- Try a move (group title)
- What if I spend / preview before you decide
- Recovery / something has to move
- Share a cycle / a quiet win card
- Your data (group title)
- Data & privacy / what's saved, what to export
- Appearance / dynamic: 'dark · tap for light' when dark, else 'light · tap for dark'
- App lock / Face ID · off
- Fast-forward 1 month / demo: age dates, close a cycle
- Start fresh / clears everything (tone negative)
- Tap export any time. Tap start fresh and it's gone. (closing MeloLine)
- → (trailing chevron glyph on every row)

## tokens

- --accent (accent word + ring context)
- --surface (group card background)
- --hairline (card border via hairline utility + divide-y row dividers)
- --muted-ink (eyebrow, group titles, row hints, chevron)
- --negative (Start fresh label tone)
- --paper (screen ground, inherited)
- --ink (default text + Melo outline)
- --caution (Melo folded corner)

## motions

- slide-in-r — screen mount entrance (translateX 28→0). Doc block notes 240ms intent but styles.css ships 360ms cubic-bezier(.16,1,.3,1) — mirror styles.css.
- press — every row scales to 0.97 over 120ms ease on press (RN: Pressable + Haptics.selectionAsync)
- pebble-breathe — Melo soft companion idle breathing (4.4s, continuous; only infinite animation on this quiet screen)
- pebble-blink — Melo eyes (~5.4s offset)

## moods

- soft — the header <Melo size={30} mood="soft"> companion (the rare quiet expression; keep verbatim, do NOT swap to calm)
- MeloLine at the foot passes no mood prop → inherits MeloLine's default (calm)

## componentTree

<![CDATA[
<Screen className="slide-in-r" scrollable noScrollbar paddingX={28} paddingTop={16}>   // px-7 pt-4
  {/* Header */}
  <Row justify="space-between" align="center">
    <Text fontDisplay italic size={14}>Folio</Text>
    <Spacer width={20} />                                  // w-5 balance spacer (not a button)
  </Row>

  {/* Hero / intro */}
  <Row marginTop={24} align="flex-start" gap={12}>
    <Melo size={30} mood="soft" />
    <Column flex={1}>
      <Text fontDisplay italic size={13} color="--muted-ink">The quiet hub</Text>
      <Heading fontDisplay size={30} lineHeight={1.05} marginTop={4}>
        Everything else, <Accent notItalic color="--accent">calmly</Accent>.
      </Heading>
    </Column>
  </Row>

  {/* Grouped link lists */}
  <Column marginTop={28} gap={24}>                          // space-y-6
    {groups.map(g => (
      <Column key={g.title}>
        <Text size={11} uppercase tracking={0.16} color="--muted-ink" marginBottom={8} paddingX={4}>{g.title}</Text>
        <Card background="--surface" hairline radius={16} dividers="--hairline">   // rounded-2xl divide-y
          {g.rows.map(r => (
            <Pressable key={r.label} className="press"
              onPress={() => r.onClick?.() ?? (r.sheet ? nav.openSheet(r.sheet) : r.to && nav.go(r.to))}
              paddingX={20} paddingY={16} flexDirection="row" align="center" textAlign="left">
              <Column flex={1}>
                <Text size={15} weight="500" color={r.tone === "negative" ? "--negative" : "--ink"}>{r.label}</Text>
                <Text size={12} color="--muted-ink" marginTop={2}>{r.hint}</Text>
              </Column>
              <Text color="--muted-ink">→</Text>
            </Pressable>
          ))}
        </Card>
      </Column>
    ))}
  </Column>

  {/* Closing reassurance */}
  <Box marginTop={24} marginBottom={32}>
    <MeloLine text="Tap export any time. Tap start fresh and it's gone." />
  </Box>
</Screen>

// groups: [The picture: Timeline→timeline, Calendar→calendar, Plans→plans, Insights→insights]
//         [Tend the picture: Subscriptions→subs, Pots→pots, Payday & income→sheet:onboarding, Payday review→ritual]
//         [Try a move: What if I spend→whatif, Recovery→recovery, Share a cycle→sheet:share]
//         [Your data: Data & privacy→privacy, Appearance→toggleTheme(), App lock→more(no-op), Fast-forward 1 month→fastForwardMonth()+go(insights), Start fresh→resetAll()+go(start) tone:negative]
]]>

## enginesNeeded

- None — depends on no product engine; it is routing chrome.
- store actions only: fastForwardMonth() and resetAll() (dev/demo writes) from src/lib/store.ts
- theme state: ThemeProvider/useTheme() + AsyncStorage persistence, replacing the web's document.documentElement/localStorage/meta theme-color mechanism
- Nav contract: nav.go(ScreenId), nav.openSheet(SheetId) — RN: @react-navigation/native stack + @gorhom/bottom-sheet for share & onboarding sheets

## fidelityRisks

- 'App lock' row routes to 'more' (its own screen id) — a dead/no-op self-link; no App-lock surface exists. Keep the row visually but flag for real wiring or an explicit placeholder; keep the honest hint 'Face ID · off'.
- useTheme() is web-coupled (document.documentElement.classList, localStorage('folio-theme'), meta theme-color). None exist in RN — re-implement as a theme store/context, persist via AsyncStorage, drop the meta tag, use StatusBar/native theming. Appearance hint must stay driven by live theme.
- Appearance is an onClick row that toggles in place — must NOT push a screen. The → chevron still renders on it; keep it but ensure tapping only toggles theme.
- Press-handler precedence is onClick > sheet > to. Preserve exactly so 'Payday & income' opens the onboarding SHEET (not a screen) and 'Share a cycle' opens the share sheet.
- Melo mood is 'soft' (size 30) — easy to default-swap to 'calm'. Keep 'soft' verbatim; it is intentional for the hub.
- Group card uses divide-y dividers + a hairline outer border. RN has no divide-y; render separators with StyleSheet.hairlineWidth between rows + a 1px hairline container border (color --hairline). rounded-2xl = 16px radius; clip row press highlight to the rounded card (overflow hidden).
- Accent 'calmly' is <em not-italic> inside an upright font-display heading — render upright + terracotta, NOT italic.
- Dev/demo rows (Fast-forward, Start fresh) must stay LAST and visually quiet per @notes — same row styling; only 'Start fresh' gets --negative label tone. Don't elevate with buttons/badges.
- fastForwardMonth()→nav.go('insights') and resetAll()→nav.go('start'): navigation is part of the action; fire after the store write. resetAll re-seeds transactions, so 'Start fresh' is not a true empty state.
- Chevron is a literal '→' text glyph in --muted-ink, not a lucide icon. May substitute lucide-react-native ChevronRight, but keep it quiet and --muted-ink; no new accent.
- slide-in-r duration mismatch: doc block 240ms vs styles.css 360ms — use styles.css (360ms, cubic-bezier(.16,1,.3,1)); collapse to final state under AccessibilityInfo.isReduceMotionEnabled.
- Header carries a 'Folio' wordmark (font-display italic 14px) + a 20px empty balance spacer (w-5) on the right — keep the spacer so the wordmark stays left-aligned; it is not a button.
- Scroll container hides scrollbars (no-scrollbar) and has 32px bottom margin (mb-8) so the last MeloLine clears the tab bar — preserve with paddingBottom + safe-area inset in RN.
- State matrix: More is populated-only (empty/loading/error n/a, offline == populated). Do NOT add spinners or empty-state primitives; render the static groups immediately, including offline.

