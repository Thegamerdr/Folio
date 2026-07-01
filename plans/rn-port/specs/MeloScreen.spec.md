# MeloScreen (C:\dev\folio-melo\.claude\worktrees\design-main\src\components\folio\screens\ScreenMelo.tsx)

## file

C:\dev\folio-melo\.claude\worktrees\design-main\src\components\folio\screens\ScreenMelo.tsx

## rnComponentName

MeloScreen

## purpose

Standalone Melo companion/persona surface: a hero Melo card that reflects the current money-pressure mood plus a 5-row pressure-mood picker that lets the user switch pressure and watch Melo (and, conceptually, the money path) change with it. In the live prototype it is a persona/mood playground driven entirely by nav.pressure — NOT the full chat surface its doc block describes.

## reads

- nav.pressure (current Pressure: safe|calm|soft|pressured|overspent)
- pressureMood[nav.pressure] (Pressure -> Melo mood alias calm|soft|alert)
- pressureLine[nav.pressure] (quoted Fraunces line under hero Melo)
- pressureLine[p] for each of the 5 rows
- pressureMood[p] for each of the 5 rows
- DOC-BLOCK CLAIMS NOT honored by rendered JSX: @reads 'Full app snapshot via SheetMeloChat'

## writes

- nav.setPressure(p) on row tap — sets active Pressure (the ONLY write the rendered component performs)
- nav.back() — header back button
- DOC-BLOCK CLAIMS NOT honored by rendered JSX: @writes applyMeloTool (via tools); @opens-sheet melo-chat. The component imports ~20 store actions (setPots, setSubs, togglePaused, pauseMany, addCycle, setOnboarding, resetAll, fastForwardMonth, removeSub, addToPot, markSubUsed, addTransaction, removeTransaction) and assets (meloHero, waxSeal) but NONE are used in the JSX — dead imports.

## opensSheets

## copyKeys

- Melo (header eyebrow label; also COPY_DECK melo.name)
- Companion (display-italic kicker)
- A quiet presence across the journey. (h2 headline; 'quiet' is the terracotta accent word, rendered not-italic)
- pressureLine.safe = "Plenty of room. Breathe." (from types.ts, NOT COPY_DECK)
- pressureLine.calm = "You make it to payday."
- pressureLine.soft = "Tight — but the path holds."
- pressureLine.pressured = "The middle of next week is the squeeze."
- pressureLine.overspent = "Something has to move. Let's look together."
- Row labels (capitalized Pressure keys): safe, calm, soft, pressured, overspent
- Try each mood — Melo changes, and your money path shifts with her. (footer hint)
- ← (back glyph)
- ● (active-row selected indicator glyph)

## tokens

- --muted-ink (header label, kicker, lines, hint, back glyph)
- --accent (headline accent word, active-row dot)
- --accent-soft (active row background)
- --surface (hero card bg, inactive row bg)
- --paper (screen ground, inherited)
- --ink (default text, inherited)
- --hairline (via `hairline` utility = 1px solid --hairline on hero card and every row)
- --font-display / Fraunces (kicker, headline, hero line, row lines via font-display italic)
- radius: rounded-2xl (hero card), rounded-xl (rows)

## motions

- slide-in-r (360ms cubic-bezier(.16,1,.3,1)) — whole-screen forward-nav entrance
- press (120ms, scale 0.97 on active) — back button + every pressure row
- pebble-breathe / breathe family — hero Melo (size 120) and each row Melo (size 28) breathe continuously per mood (calm->melo-breathe 4.4s, soft->normalizes to calm so melo-breathe, alert->melo-breathe-slow 6s)
- pebble-blink — Melo eyes blink (melo-eye-l 5.4s / melo-eye-r 5.4s offset) on open/up eye moods
- melo-mood-pulse (520ms) — fires on hero Melo when mood changes (key bump)
- Melo internal mood transition — 600ms cubic-bezier(.16,1,.3,1) on body tilt, ~500ms ease on mouth/eyes/ear

## moods

- Per MELO_MOODS.md the Melo-chat surface = calm, but this screen does NOT pin a mood: hero Melo and each row use pressureMood[p] -> legacy 3-way calm|soft|alert, which kit.tsx normalizeMood collapses: calm->calm, soft->calm, alert->concern. Effective rendered moods: safe=calm, calm=calm, soft=calm, pressured=concern, overspent=concern. Hero Melo also passes intensity={1.4} (amplifies tilt). RN_PORT/MELO_MOODS say DROP the soft/alert aliases in RN — the RN port must map Pressure directly to the canonical 5 moods, not via this lossy alias path.

## componentTree

<MeloScreen> // ScrollView, h-full flex-col px-7 pt-4, entrance: slide-in-r

  <Header row justify-between>
    <Pressable onPress={nav.back} class="press"> ← (20px, --muted-ink) </Pressable>
    <Text eyebrow 12px uppercase tracking-[0.14em] --muted-ink> Melo </Text>
    <Spacer w-5 />
  </Header>

  <TitleBlock mt-6>
    <Text font-display italic 13px --muted-ink> Companion </Text>
    <Text font-display 28px leading-tight mt-1>
      A <Text not-italic --accent>quiet</Text> presence across the journey.
    </Text>
  </TitleBlock>

  <HeroCard mt-6 items-center bg=--surface hairline rounded-2xl py-10>
    <Melo size={120} mood={pressureMood[nav.pressure]} intensity={1.4} />
    <Text mt-5 font-display italic 14px --muted-ink center maxW 240>
      "{pressureLine[nav.pressure]}"
    </Text>
  </HeroCard>

<PressurePicker mt-5 gap-2 (space-y-2)>
{["safe","calm","soft","pressured","overspent"].map(p =>
<Pressable key={p} onPress={() => nav.setPressure(p)}
class="press" w-full rounded-xl px-4 py-3 flex-row items-center gap-3 hairline
bg={nav.pressure===p ? --accent-soft : --surface}>
<Melo size={28} mood={pressureMood[p]} />
<View flex-1>
<Text 13px font-medium capitalize>{p}</Text>
<Text 11.5px --muted-ink font-display italic>"{pressureLine[p]}"</Text>
</View>
{nav.pressure===p && <Text --accent 12px>●</Text>}
</Pressable>
)}
</PressurePicker>

<FooterHint mt-5 mb-8 center 11px --muted-ink>
Try each mood — Melo changes, and your money path shifts with her.
</FooterHint>
</MeloScreen>

## enginesNeeded

- NONE required for this screen's rendered behavior — pure presentation driven by nav.pressure local state.
- pressureMood / pressureLine / pressureLow constant maps (src/components/folio/types.ts) — port verbatim.
- Money path engine (MONEY-PATH) — only conceptually implied by copy ('your money path shifts with her') and pressureLow; this screen does NOT call it. If RN MeloScreen becomes the real companion surface it would depend on the Money path engine for verdict/route, and the chat surface (SheetMeloChat) would read the full snapshot + write via applyMeloTool — that is the sheet's concern, not this screen.
- Melo character system (5-mood SVG + breathe/blink/mood-pulse) — shared kit dependency.

## fidelityRisks

- DOC-BLOCK vs REALITY MISMATCH (highest risk): the doc block says this screen reads the full snapshot, opens melo-chat, and writes applyMeloTool. The rendered JSX does NONE of that — it is a pressure/mood picker. Port what the JSX does, not the doc block's promises; flag to design whether RN MeloScreen should be the playground (current code) or the full chat surface (doc-block intent).
- Dead imports: ~20 store actions + meloHero/waxSeal assets imported but unused. Do NOT wire these in RN.
- Mood alias trap: this screen routes Pressure through legacy pressureMood (calm|soft|alert) which kit normalizeMood collapses (soft->calm, alert->concern). RN_PORT.md + kit.tsx say DROP soft/alert in RN. Re-map Pressure -> canonical 5 moods intentionally; currently safe/calm/soft all render identical (calm) and pressured/overspent both render concern, so 5 distinct rows show only 2 distinct Melo states — verify whether that flattening is intended.
- Copy source mismatch: hero + row lines come from types.ts pressureLine, NOT COPY_DECK.md, which is declared the single source of truth ('if a string isn't here it doesn't ship'). Migrate pressureLine into COPY_DECK before shipping or reconcile.
- Pronoun drift: footer says 'shifts with her' while MELO_MOODS.md and kit.tsx refer to Melo as 'he'/'him'. Pick one pronoun in RN copy.
- Accent-word rule: headline uses <em not-italic text-accent> to color the single word 'quiet'. RN has no inline <em>; split the headline into nested <Text> spans and color exactly one accent word.
- intensity={1.4} on hero Melo amplifies tilt beyond standard tiers; ensure the RN Melo honors an intensity prop or the hero reads flatter than web.
- Scroll + safe area: web uses overflow-y-auto no-scrollbar in a fixed phone; RN needs ScrollView showsVerticalScrollIndicator=false with top/bottom safe-area insets (px-7 horizontal, pt-4 top, mb-8 bottom).
- 'capitalize' on row labels: keys are lowercase + CSS-capitalized; in RN use textTransform:'capitalize', don't transform the data.
- Glyph fidelity: lines wrap content in literal straight double-quotes in JSX while the em dash in pressured/overspent comes from types.ts — preserve typographic glyphs exactly per COPY_DECK voice rules; render ● and ← crisply (lucide ArrowLeft for the back chevron is acceptable).
- Reduced motion: hero Melo is the only continuously-animating element; under AccessibilityInfo.isReduceMotionEnabled collapse breathe/blink/mood-pulse to final state (MOTION.md), do not slow them.

## docBlock

/\*\*

- @rn-screen MeloScreen
- @rn-stack MainTabs > Melo
- @purpose Standalone Melo surface — full chat, snapshot, persona.
- @reads Full app snapshot via SheetMeloChat
- @writes applyMeloTool (via tools)
- @opens-sheet melo-chat
- @copy FROZEN — Melo's lines come from the server persona, not this file.
- @tokens --paper --accent --hairline --muted-ink
- @motion breathe · blink · slide-in-r
  \*/

## stateBranches

- populated (the ONLY branch implemented) — always renders hero Melo + 5-row picker + hint; active row = whichever equals nav.pressure. STATES.md Melo matrix: empty n/a, loading n/a, populated done, error n/a, offline done (same as populated, no network).
- offline = identical to populated (no fetch, fully local).
- No empty/loading/error branches exist or are needed — no async, no spinner, no fallback. Do NOT invent loading/error states for this screen as-is.
- Edge: pressureMood/pressureLine are total Records over Pressure so every value renders a valid hero + row; no missing-key branch.

## rnPrimitiveMap

- root div(overflow-y-auto no-scrollbar slide-in-r) -> Animated.ScrollView showsVerticalScrollIndicator=false with entrance translateX 28->0 / opacity 0->1 over 360ms (slide-in-r); wrap in SafeAreaView
- button onClick (back + rows) -> Pressable + expo-haptics Haptics.selectionAsync(); press scale 0.97
- span/p/h2 -> Text (Fraunces embedded for font-display; SF Pro/Roboto for sans per RN_PORT)
- em.not-italic.text-accent inline -> nested <Text style={{color: accent}}> in headline (no italic)
- Melo size/mood/intensity -> react-native-svg Melo (5-mood SVG deltas) + reanimated breathe/blink/mood-pulse; viewBox 0 0 40 44, overflow visible (no clip)
- CSS vars (--paper etc.) -> theme object + useTheme() (kitTheme/useTheme/makeStyles pattern in folio-v2-greenfield)
- `hairline` utility -> borderWidth: StyleSheet.hairlineWidth, borderColor: theme.hairline
- Tailwind spacing (px-7 pt-4 mt-6 mt-5 py-10 px-4 py-3 gap-3 space-y-2 mb-8) -> StyleSheet numeric padding/margin + gap (or marginBottom between rows)
- rounded-2xl / rounded-xl -> borderRadius (confirm against design-system radius tokens; styles.css --radius-2xl=32, --radius-xl=24, --radius-lg=18)
- tracking-[0.14em] -> letterSpacing on uppercase label
- nav.back / nav.setPressure -> @react-navigation goBack() + pressure setter in app store (Zustand) or nav context
- ● and ← glyphs -> Text glyphs or lucide-react-native (ArrowLeft) for the back chevron
