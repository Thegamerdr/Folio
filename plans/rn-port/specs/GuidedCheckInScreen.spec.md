# GuidedCheckInScreen (C:/dev/folio-melo/.claude/worktrees/design-main/src/components/folio/screens/ScreenGuided.tsx)

## file

C:/dev/folio-melo/.claude/worktrees/design-main/src/components/folio/screens/ScreenGuided.tsx

## rnComponentName

GuidedCheckInScreen

## purpose

Onboarding "rough number" check-in — step two of four. Gathers the user's currently-visible cash balance via a custom on-screen numeric keypad (no system keyboard, no account required), then advances to the intake flow. Doc-block @purpose verbatim: "Rough-number check-in — gather payday + income + headline spend without an account." Doc-block @rn-stack: Onboarding > Guided. @copy: FROZEN.

## reads

- onboarding (DECLARED in @reads doc block, sourced via useAppStore) — NOT actually read in the current implementation: the balance is local useState seeded to the string "1240". RN port must reconcile per fidelityRisks.
- nav (prop: Nav) — uses nav.back and nav.go only; does NOT use nav.pressure/openSheet/openMelo here.

## writes

- setOnboarding (DECLARED in @writes doc block; imported from @/lib/store) — NOT actually called in the current implementation. The entered balance is never persisted; Continue only calls nav.go("intake"). RN port MUST wire the entered amount through setOnboarding (e.g. visibleCash) before navigating.
- local useState `value` (string, seed "1240") — mutated by the keypad press handler (append digit, append single ".", backspace-to-"0").

## opensSheets

## copyKeys

- Step two
- What money can you see today? (accent word "see" → em.not-italic.text-accent)
- A rough number is fine.
- In your account
- £ (COPY_DECK currency.symbol)
- {balance} — Number(value).toLocaleString('en-GB'); default seed 1240 → "1,240"
- current
- savings
- cash
- An estimate is fine — we'll get clearer together. (passed to MeloLine)
- Keypad keys: 1 2 3 4 5 6 7 8 9 . 0 ← (← = backspace glyph)
- Continue
- Skip (top-right nav)
- ← (top-left back nav glyph)

## tokens

- --paper
- --ink
- --accent
- --muted-ink
- --surface
- --inset
- --hairline
- --radius-xl (rounded-2xl = 24px: balance card + Continue button)
- --radius-md (rounded-xl = 12px: keypad keys)
- pill/rounded-full (progress ticks + current/savings/cash chips)
- --font-display Fraunces (label, headline, balance figure, keypad keys)
- tabular (font-variant: tabular-nums on the £ + balance + keypad)
- --color-primary-foreground #FFFFFF (Continue label, written as text-white)

## motions

- slide-in-r — root container entrance (360ms cubic-bezier(.16,1,.3,1); RN: reanimated withTiming translateX 28→0 + opacity 0→1)
- count-up / .countup — balance figure entrance; span is re-keyed by `value` so the entrance REPLAYS on every keystroke (0.8s ease-out, translateY 6→0 + fade). RN: replay an Animated entrance keyed off the value, or fade per change. Money never slides per MOTION.md — keep it count-up style.
- press — 120ms scale→0.97 on active; applied to back btn, Skip, every keypad key, and Continue. RN: Pressable + scale + Haptics.selectionAsync().
- animate-pulse — terracotta caret bar to the right of the amount (Tailwind opacity pulse; NOT in MOTION.md named set). RN: gentle infinite opacity blink on the accent caret; collapse to static under reduced motion.

## moods

- None rendered as a standalone <Melo> on this screen. Melo appears ONLY indirectly inside <MeloLine> (the canonical inline Melo + Fraunces-italic composition).
- MELO_MOODS.md surface mapping for Onboarding step 1-3 = calm; the MeloLine's Melo should therefore use mood="calm" (this is step two).

## componentTree

<Screen> // SafeAreaView, flex:1, bg --paper, px-7 pt-4, entrance=slide-in-r
<TopBar> // row, space-between, align-center
<PressableBack onPress={nav.back}>← (muted-ink, 20px, press)</PressableBack>
<ProgressTicks> // row gap 1.5; four 24x4 rounded-full bars
<Tick filled/> // bg --accent
<Tick filled/> // bg --accent
<Tick/> // bg --hairline
<Tick/> // bg --hairline
</ProgressTicks>
<PressableSkip onPress={() => nav.go("today")}>Skip (13px, muted-ink, press)</PressableSkip>
</TopBar>

  <Heading mt-8>
    <Text font-display italic 14 muted-ink>Step two</Text>
    <Text font-display 30 leading-tight mt-1>What money can you <Accent>see</Accent> today?</Text> // Accent = not-italic terracotta
    <Text 13.5 muted-ink mt-3 maxW-280>A rough number is fine.</Text>
  </Heading>

<BalanceCard mt-6 bg --surface hairline rounded-2xl p-6>
<Label 11 uppercase tracking-0.14em muted-ink>In your account</Label>
<AmountRow mt-2 row align-baseline gap-1>
<Text font-display tabular 52 leading-none>£</Text>
<Text key={value} font-display tabular 52 leading-none countup>{shown}</Text>
<Caret ml-1 w-2px h-9 bg --accent animate-pulse/>
</AmountRow>
<ChipsRow mt-4 row gap-2>
{["current","savings","cash"].map(t => <Chip 11 px-2 py-1 rounded-full bg --inset muted-ink>{t}</Chip>)}
</ChipsRow>
</BalanceCard>

  <MeloLineRow mt-4>
    <MeloLine text="An estimate is fine — we'll get clearer together." /> // mood calm
  </MeloLineRow>

  <Spacer flex-1/>

<Keypad grid 3-col gap-2 mb-3> // keys = 1..9 . 0 ←
{keys.map(k => <Key onPress={() => press(k)} press h-12 rounded-xl bg --surface hairline font-display tabular 20>{k}</Key>)}
</Keypad>

<Continue onPress={() => nav.go("intake")} press w-full h-54 rounded-2xl bg --accent text-white font-medium 15.5>Continue</Continue>
<BottomSpacer h-4/>
</Screen>

// Keypad handler `press(k)`:
// "←" → value.slice(0,-1) || "0"
// "." → value.includes(".") ? value : value + "."
// else → value === "0" ? k : value + k
// `shown` = Number(value).toLocaleString("en-GB")

## enginesNeeded

- None. Pure UI + local component state. No money-path/cycle/reader/pot/insights/nudge engine is touched.
- Onboarding store slice (RN: store onboarding object + setOnboarding action) — required to make this screen actually persist the visible-cash figure, which the doc block promises but the prototype omits.
- Number formatting: Intl/toLocaleString('en-GB') equivalent (RN: Intl is available on Hermes with full-icu, or use a small grouping util). No GBP decimal here — integer grouping only; the kit's formatGBP is imported in the file but NOT used by this screen.

## fidelityRisks

- CONTRACT vs IMPLEMENTATION GAP: doc block says @reads onboarding / @writes setOnboarding, but the code neither reads the store nor calls setOnboarding — it uses local useState("1240") and just nav.go("intake"). Do NOT copy the dead behavior: the RN port must persist the entered balance via setOnboarding before navigating, and ideally seed `value` from the store instead of a hardcoded "1240".
- Custom keypad, not the OS keyboard. Keep the 3-col grid of Pressables; do NOT swap to a TextInput numeric pad (breaks the paper-luxury feel and the count-up-per-keystroke motion). RN: an accessible row of Pressables with aria/label per key.
- Decimal/format edge cases: value can end in "." (e.g. "12.") and Number("12.")→12, so "12." shows as "12"; multiple "." blocked; leading "0" replaced by first digit; backspace to empty falls back to "0". toLocaleString strips trailing-dot and does not show pence. Mirror these exact rules.
- count-up replays on every keystroke because the figure span is keyed by `value`. That is intentional (each digit re-ticks). In RN, re-mounting/replaying a full count-up per keystroke can feel busy/janky — tune to a quick fade or short tick; never a slide (MONEY NEVER SLIDES per MOTION.md).
- The pulsing caret uses Tailwind animate-pulse, which is NOT a Folio named motion. Keep it subtle; under reduce-motion render a static caret. Don't let it read as a second infinite animation competing with Melo (room-tone rule).
- Tabular figures are load-bearing for money — RN <Text> must set fontVariant:['tabular-nums'] on £, the amount, and the keypad, or digits will jitter width as they change.
- Fraunces must be embedded in RN for the label/headline/amount/keys; falling back to system serif loses the editorial identity. Headline accent word "see" is terracotta and explicitly not-italic inside an otherwise upright display headline.
- px-7 (28px) horizontal padding + flex-1 spacer pushing keypad+Continue to the bottom: replicate with flex:1 spacer and SafeArea bottom inset, and ensure the keypad/CTA clear the gesture/home indicator on device.
- Skip routes straight to "today" (bypasses intake and any onboarding capture) and back uses nav.back — wire both into the RN onboarding stack (react-navigation), and decide whether Skip should still seed a default onboarding so Today has data.
- Progress ticks are hardcoded 2-of-4 filled (step two). If the RN onboarding flow is dynamic, drive fill from the current step index rather than hardcoding.
- Copy is FROZEN — every visible string must come from COPY_DECK (no key currently exists for these guided/keypad strings; they are inline in the prototype). Add the missing keys to the copy deck rather than hardcoding in the RN component, and respect banned words.

## rnPrimitiveMap

- div.h-full.flex.flex-col → View flex:1 / SafeAreaView
- button + .press → Pressable + scale-to-0.97 + expo-haptics Haptics.selectionAsync()
- <MeloLine> → RN MeloLine (react-native-svg Melo mood=calm + Fraunces-italic Text)
- CSS vars (--paper/--ink/--accent/--muted-ink/--surface/--inset/--hairline) → theme object + useTheme()
- hairline border utility → borderWidth: StyleSheet.hairlineWidth, borderColor: --hairline
- rounded-2xl / rounded-xl / rounded-full → borderRadius 24 / 12 / 999
- grid grid-cols-3 gap-2 → flexDirection row + flexWrap with 3 columns (gap or width:'31%' + margins), or FlatList numColumns=3
- font-display → fontFamily Fraunces; tabular → fontVariant:['tabular-nums']
- span key={value} .countup → Animated.Text / reanimated entrance keyed off value (replay per keystroke)
- animate-pulse caret → reanimated withRepeat(withTiming(opacity)) on a 2px accent View
- Number(value).toLocaleString('en-GB') → Intl.NumberFormat('en-GB') (Hermes full-icu) or grouping util
- nav.go / nav.back (local Nav) → @react-navigation native stack navigation.navigate / goBack
- text-white on accent button → color: theme primaryForeground (#FFFFFF)
- slide-in-r class → reanimated entering animation (translateX 28→0, 360ms, cubic-bezier .16,1,.3,1)

## stateBranches

- populated (the only real branch): seeded value "1240" → "£1,240"; keypad edits live-update the figure with a per-keystroke count-up. STATES.md marks Guided populated = ✅ done; empty/loading/error = n/a.
- offline: identical to populated — Folio is local-first, this screen does no network; nothing degrades.
- empty: n/a per STATES.md, but note the in-screen 'zero' edge — backspacing to nothing yields "0" → "£0" (still valid, Continue stays enabled).
- loading: n/a — no async on this screen; no spinner ever (no-spinner rule).
- error: n/a — no fallible operation on this screen.

## docBlock

/\*\*

- @rn-screen GuidedCheckInScreen
- @rn-stack Onboarding > Guided
- @purpose Rough-number check-in — gather payday + income + headline spend without an account.
- @reads onboarding
- @writes setOnboarding
- @opens-sheet —
- @copy FROZEN
- @tokens --paper --ink --accent --muted-ink
- @motion slide-in-r · press .97/120ms
  \*/
