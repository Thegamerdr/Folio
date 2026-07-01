# StartScreen (C:/dev/folio-melo/.claude/worktrees/design-main/src/components/folio/screens/ScreenStart.tsx)

## file

C:/dev/folio-melo/.claude/worktrees/design-main/src/components/folio/screens/ScreenStart.tsx

## rnComponentName

StartScreen

## purpose

First-run doorway. Frames the single question Folio answers ("Will your money last to payday?") and offers four ways in: the primary "See where you stand" guided path, plus three secondary entries (Add a statement / Try sample data / Meet Melo) and a Privacy link in the header. Pure presentational screen with no store reads or writes; it only navigates via the nav prop. "Try sample data" jumps straight to Today with seed data (skips intake).

## docBlock

@rn-screen StartScreen
@rn-stack Onboarding > Start
@purpose First-run doorway — frames the one question Folio answers, offers three paths in.
@reads —
@writes —
@opens-sheet —
@copy FROZEN
@tokens --paper --accent --muted-ink --hairline · Fraunces hero
@motion slide-in-r · pointer-nudge on CTA arrow · press .97/120ms
@notes "Try sample data" path skips intake and jumps to Today with seeds.

## reads

- nav (prop) — the only input; component reads nothing from the store
- nav.go(ScreenId) — used for every navigation target (privacy, guided, intake, today, melo)
- Doc block declares @reads — (none); confirmed: no useAppStore selectors are actually used despite the import

## writes

- none — doc block @writes — ; no store actions called
- NOTE: the file imports a large set of store actions (setPots, setSubs, togglePaused, addCycle, setOnboarding, resetAll, fastForwardMonth, etc.) but NONE are used in ScreenStart. These are dead imports for this screen; do NOT port them. The 'Try sample data' seeding the @notes references is NOT implemented in this component (it just nav.go('today')) — the RN seed path lives elsewhere.

## opensSheets

- none — @opens-sheet — ; navigation is screen-to-screen via nav.go, never a sheet

## copyKeys

- Folio — wordmark, font-display italic 15px (COPY_DECK app.name)
- Privacy — header link, uppercase, tracking-wide, 12px, --muted-ink
- Will your money last to payday? — hero H1; the word 'last' is the single accent word, rendered <em class=not-italic text=--accent>. COPY_DECK app.tag stores the first-person variant 'Will my money last to payday?'; this screen uses the second-person headline form verbatim.
- Start with a rough number. Nothing counts until you choose. — subhead, 15px --muted-ink, max-width 300
- Start rough. You can correct anything later. — MeloLine quoted copy (Fraunces italic, wrapped in straight quotes by the MeloLine primitive)
- See where you stand — primary CTA label, 16px medium white
- → — CTA trailing arrow glyph (U+2192), carries pointer-nudge motion
- Add a statement — secondary link (→ nav.go('intake'))
- Try sample data — secondary link (→ nav.go('today'))
- Meet Melo — secondary link (→ nav.go('melo'))
- All Start strings are literal/inline and @copy FROZEN — they are NOT keyed in COPY_DECK (only app.name/app.tag are). Port them verbatim; do not paraphrase.

## tokens

- --paper (screen ground)
- --accent (#E0633A — accent word 'last', CTA fill)
- --muted-ink (#6B6760 — subhead, Privacy link, secondary links)
- --hairline (#ECE9E0 — the two 1px vertical divider rules between secondary links)
- --font-display (Fraunces — wordmark + hero H1 + MeloLine italic)
- --font-sans (Inter Tight — CTA label, secondary links)
- CTA text #FFFFFF (--color-primary-foreground)
- CTA shadow literal (hardcoded, not a token): 0 12px 24px -10px rgba(224,99,58,0.55), inset 0 1px 0 rgba(255,255,255,0.2)
- radius: rounded-2xl = 24px (--radius-xl) on CTA
- Melo outline uses --ink, paper --surface, folded corner --caution (inside the MeloLine companion)

## motions

- slide-in-r — whole screen enter, 360ms cubic-bezier(.16,1,.3,1), translateX 28→0 + fade
- pointer-nudge — CTA '→' arrow, 1600ms ease-in-out infinite, translateX 0→6px + opacity .6→1 (suggests 'go')
- press — every tappable (Privacy, CTA, 3 secondary links) scales to 0.97 over 120ms on active; RN = Pressable + Haptics.selectionAsync()
- pebble-breathe (4.4s) + blink (5.4s offset L/R) — continuous, inside the MeloLine Melo (calm mood); the only continuous motion on the resting screen

## moods

- calm — the MeloLine here uses MeloLine's default mood='calm', size=28. MELO_MOODS.md maps Start (first-run welcome) and Privacy to calm. No pose (pose='none'). Melo is grounded (default ground shadow on).

## componentTree

<Screen style={paper, flex:1, px:28, pt:40} entering={SlideInRight 360ms}>
<Row justify="space-between" align="center">
<Text fontDisplay italic size={15}>Folio</Text>
<Pressable press onPress={()=>nav.go('privacy')}>
<Text size={12} color={mutedInk} uppercase tracking>Privacy</Text>
</Pressable>
</Row>

  <View mt={56}>
    <Text fontDisplay size={42} lineHeight={1.05} tracking="tight">
      Will your money <Text color={accent} /* not-italic */>last</Text> to payday?
    </Text>
    <Text mt={20} size={15} lineHeight="relaxed" color={mutedInk} maxWidth={300}>
      Start with a rough number. Nothing counts until you choose.
    </Text>
  </View>

  <View mt={40}>
    <MeloLine text="Start rough. You can correct anything later." /* mood=calm size=28 */ />
  </View>

<View flex={1} /> {/_ spacer pushes CTA to bottom _/}

<Pressable press onPress={()=>nav.go('guided')}
style={{ w:'100%', h:60, radius:24, bg:accent, shadow:ctaShadow,
             flexDirection:'row', align:'center', justify:'center', gap:8 }}>
<Text color="#FFFFFF" weight="medium" size={16} tracking={-0.01}>See where you stand</Text>
<Animated.Text style={pointerNudge} size={18}>→</Animated.Text>
</Pressable>

<Row mt={20} justify="space-between" align="center" gap={12}
style={{ fontSize:12.5, color:mutedInk }}>
<Pressable press onPress={()=>nav.go('intake')}><Text>Add a statement</Text></Pressable>
<View w={1} h={12} bg={hairline} />
<Pressable press onPress={()=>nav.go('today')}><Text>Try sample data</Text></Pressable>
<View w={1} h={12} bg={hairline} />
<Pressable press onPress={()=>nav.go('melo')}><Text>Meet Melo</Text></Pressable>
</Row>

<View h={24} /> {/_ bottom safe-area breathing room _/}
</Screen>

## enginesNeeded

- None. This screen depends on no engine and no data — it is the first-run welcome. It only needs the navigation stack (@react-navigation/native) and routes for: privacy, guided, intake, today, melo.
- Downstream only: 'Try sample data' (nav.go('today')) implies the RN app must seed sample data somewhere on the Today path; per RN_PORT.md that seeding logic must NOT be a manual form and is out of scope for THIS screen.
- MeloLine companion needs the Melo SVG character (react-native-svg, 5 moods) — calm mood only here.

## fidelityRisks

- Accent word: 'last' must be inline-colored INSIDE the headline run (RN nested <Text>), and must be UPRIGHT not italic — the web uses em.not-italic. A naive <em> port would italicize it (wrong).
- MeloLine wraps its text in literal straight quotes ("…") via the primitive — don't double-quote in the string; pass the raw text and let the RN MeloLine add quotes, matching web.
- Bottom layout uses flex-1 spacer to pin the CTA + links to the bottom; in RN this needs flex:1 spacer inside a flex column with the screen filling height (and SafeArea for the bottom h-6). Easy to get a top-aligned stack instead.
- CTA shadow is a hardcoded multi-layer + inset shadow; RN has no inset box-shadow. Approximate with elevation/shadow for the outer glow and drop the inset highlight, or layer a subtle top gradient — do not lose the warm terracotta glow that makes the button feel raised.
- pointer-nudge is an infinite micro-animation on the arrow only — it must respect AccessibilityInfo.isReduceMotionEnabled (collapse to final/static), same for slide-in-r and Melo breathe/blink. Reduced motion = final state, not slower.
- Dead store imports: the file imports many store actions that ScreenStart never uses. Do not wire any store reads/writes into StartScreen; @reads/@writes are both empty.
- Headline copy is second-person ('your') while COPY_DECK app.tag is first-person ('my'). Use the on-screen second-person form verbatim; don't 'correct' it to the COPY_DECK key.
- Banned-word risk: keep secondary link 'Add a statement' (verb form) — never 'Import statement' (COPY_DECK bans 'import').
- Type scale must use the one system: Fraunces for wordmark/hero/MeloLine, Inter Tight for CTA/links. No second font, no second spacing scale.
- press scale (0.97/120ms) should pair with expo-haptics selection feedback on all four tappables for parity with the web 'press' feel.

## stateBranches

- populated — the ONLY branch. STATES.md lists Start as populated-only (empty/loading/error/offline = n/a). There is no data to be empty, nothing async to load, nothing to fail.
- offline — implicitly identical to populated (local-first, no network dependency on this screen).
- No empty/loading/error states to render.

## rnPrimitiveMap

- <div> → <View> / SafeAreaView (root); use flex column, flex-1 spacer for bottom pinning
- <h1>/<p>/<span> → <Text> (Fraunces via fontFamily for display, Inter Tight for sans)
- <em class=not-italic text=accent> → nested <Text style={{color:accent}}> with normal fontStyle (NOT italic)
- <button> → Pressable + Haptics.selectionAsync(); 'press' util → animated scale 0.97 (reanimated withTiming 120ms) on pressIn/out
- CSS box-shadow (CTA) → iOS shadowColor/shadowOffset/shadowRadius/shadowOpacity + Android elevation; inset highlight has no RN equivalent (approximate or drop)
- vertical divider <span class='w-px h-3 bg-hairline'> → <View style={{width: StyleSheet.hairlineWidth or 1, height:12, backgroundColor: hairline}}>
- CSS tokens (--paper etc.) → theme object + useTheme() hook
- slide-in-r class → react-native-reanimated entering animation (SlideInRight / withTiming translateX 28→0, 360ms)
- pointer-nudge keyframe → reanimated withRepeat(withTiming(translateX 6, 1600ms), -1, true) on the arrow Text
- MeloLine (web kit) → RN MeloLine (Melo react-native-svg + Fraunces italic Text)
- nav.go(ScreenId) (local prop) → navigation.navigate(routeName) via @react-navigation/native stack
