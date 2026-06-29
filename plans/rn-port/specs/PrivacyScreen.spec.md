# PrivacyScreen  (C:/dev/folio-melo/.claude/worktrees/design-main/src/components/folio/screens/ScreenPrivacy.tsx)

## file

C:/dev/folio-melo/.claude/worktrees/design-main/src/components/folio/screens/ScreenPrivacy.tsx

## rnComponentName

PrivacyScreen

## purpose

A plain, honest statement of what Folio does and doesn't do with the user's data, plus two data actions: Export my data (opens the share sheet) and Start fresh (wipes + reseeds state, navigates to Start, offers Undo). Lives at More > Data & privacy. Copy is FROZEN and copy-lint-checked: no false privacy/security claims. Static, stateless presentational screen — no async, no engines, no reactive store subscription; it only touches the store imperatively when Start fresh fires.

## docBlock

@rn-screen    PrivacyScreen
@rn-stack     More > Data & privacy
@purpose      Plain statement of what Folio does (and doesn't do) with the user's data, plus export and reset.
@reads       —
@writes       resetAll() (via Start fresh)
@opens-sheet  share (export)
@copy         FROZEN — must match what the app actually does. No false claims.
@tokens       --accent --positive --negative --surface --hairline --muted-ink
@motion       slide-in-r on mount · press .97/120ms
@notes        Claims here are checked by RN copy-lint tests. Edit copy with care.

## reads

- getState() — called imperatively ONLY inside the Start fresh handler to snapshot current state ({...getState()}) for the Undo action; not a reactive subscription. Doc block @reads is intentionally empty (—): nothing is read for render.

## writes

- resetAll() — clears state and RESEEDS it with seedTransactions() + empty calendarEvents (NOT a truly empty store), then persist() + emit(). Fidelity note: 'clears everything' copy overstates it; RN behavior must match whatever resetAll does on RN.
- setPartial(snapshot) — Undo path; restores the full pre-reset snapshot object captured before resetAll().

## opensSheets

- share

## copyKeys

- NO COPY_DECK keys exist for this screen — every string is an inline literal and must be migrated into COPY_DECK.md before RN ship (RN_PORT rule: a string not in the deck doesn't ship). Verbatim strings below.
- Your data
- Your data, your call.
- your call.
- Folio shows you what's saved, lets you export it, and wipes it when you say so.
- No ads, no tracking
- Nothing shared without you tapping export
- Delete everything in one tap
- Export my data
- See what's saved
- everything you've added
- Start fresh
- clears everything
- Started fresh
- Everything cleared.
- Undo
- "Your numbers are yours to keep or export."
- ← (back glyph, aria-label "Back")
- ✓ (check glyph)
- → (row chevrons)

## tokens

- --accent (headline accent word 'your call.'; primary button bg; button drop shadow rgba(224,99,58,0.55))
- --positive (check badge: 15% tint fill via bg-[var(--positive)]/15; ✓ glyph color)
- --negative (Start fresh title color)
- --surface (action list card bg)
- --hairline (card 1px border via hairline utility + divider via divide-[var(--hairline)])
- --muted-ink (eyebrow, body paragraph, row subtitles, chevrons, back glyph, Melo line)
- white / #FFFFFF (primary button label, mapped to --color-primary-foreground)
- radius: rounded-2xl = 24px (--radius-xl) for primary button + action card
- spacing: px-7 (28), pt-4, mt-10, mt-6, mt-8, mt-3, gap-3, py-4, px-5
- type: font-display = Fraunces (headline 36px/1.05, Melo line italic 12.5px); body Inter Tight 14/13.5/13/12/12.5px

## motions

- slide-in-r (mount; translateX 28→0, 360ms cubic-bezier(.16,1,.3,1)) — RN: withTiming translateX 24→0 ~240-360ms
- press (all tappable: back, primary button, both list rows; scale→0.97, 120ms ease) — RN: Pressable + scale + Haptics.selectionAsync()
- Melo always-on breathe (mood at size 28) at footer; no count-up / route-draw / verdict-stamp on this screen

## moods

- soft — the only Melo on screen, size 28, grounded default, at the footer beside the italic line. WARNING: mood="soft" is NOT one of the five canonical moods (calm|curious|cheer|concern|celebrate); MELO_MOODS maps Privacy to 'calm'. Resolve before RN: treat 'soft' as the rare soft-eyes expression noted in the mood doc, or use 'calm' per the surface map. Flag to design.

## componentTree

<View flex-1 px-7 pt-4 (slide-in-r on mount)>
  {/* top bar */}
  <View row items-center justify-between>
    <Pressable onPress={nav.back} accessibilityLabel="Back" (press)><Text muted 20px>←</Text></Pressable>
    <Text muted 12px uppercase tracking-0.14em>Your data</Text>
    <View w-5 aria-hidden />   {/* spacer to center the eyebrow */}
  </View>

  {/* headline block */}
  <View mt-10>
    <Text font-display 36px lineHeight 1.05>
      Your data, <Text accent upright>your call.</Text>   {/* em is not-italic + accent color */}
    </Text>
    <Text 14px muted mt-4 leading-relaxed maxWidth 300>Folio shows you what's saved, lets you export it, and wipes it when you say so.</Text>
  </View>

  {/* three honest claims */}
  <View mt-6 gap-2>
    {["No ads, no tracking","Nothing shared without you tapping export","Delete everything in one tap"].map(t =>
      <View key={t} row items-center gap-3 text-13.5px>
        <View w-5 h-5 rounded-full bg-positive/15 items-center justify-center><Text positive 11px>✓</Text></View>
        <Text>{t}</Text>
      </View>
    )}
  </View>

  {/* primary CTA */}
  <Pressable onPress={() => nav.openSheet("share")} (press)
    mt-8 w-full h-56 rounded-2xl bg-accent shadow(0 12px 24px -10px rgba(224,99,58,0.55))>
    <Text white font-medium 15px>Export my data</Text>
  </Pressable>

  {/* action list card (surface + hairline + one inter-row divider) */}
  <View mt-3 bg-surface hairline rounded-2xl>
    <Pressable onPress={() => nav.go("timeline")} (press) px-5 py-4 row items-center>
      <View flex-1>
        <Text 15px font-medium>See what's saved</Text>
        <Text 12px muted mt-0.5>everything you've added</Text>
      </View>
      <Text muted>→</Text>
    </Pressable>
    <View hairline-top />   {/* divide-y: single divider between the two rows */}
    <Pressable onPress={handleStartFresh} (press) px-5 py-4 row items-center>
      <View flex-1>
        <Text 15px font-medium negative>Start fresh</Text>
        <Text 12px muted mt-0.5>clears everything</Text>
      </View>
      <Text muted>→</Text>
    </Pressable>
  </View>

  <View flex-1 />   {/* push Melo line to bottom */}

  {/* Melo footer line */}
  <View mt-6 mb-6 row items-center gap-3>
    <Melo size={28} mood="soft" />
    <Text 12.5px muted font-display italic>"Your numbers are yours to keep or export."</Text>
  </View>
</View>

// handleStartFresh:
//   const snapshot = { ...getState() };
//   resetAll(); nav.go("start");
//   toast("Started fresh", { description: "Everything cleared.", duration: 6000,
//     action: { label: "Undo", onClick: () => setPartial(snapshot) } });
// RN: replace sonner toast with RN snackbar; keep 6000ms + Undo wired to setPartial(snapshot).

## enginesNeeded

- None. No money-path/cycle/reader/insights/pots engine. Pure presentational + two store actions (resetAll, setPartial) + one read (getState).
- store: @/lib/store — getState, resetAll, setPartial. RN: same local-first store; resetAll reseeds via seedTransactions().
- share sheet: the 'share' SheetId / export flow (separate component; this screen only opens it).
- toast/snackbar: sonner (web) → RN toast lib supporting title + description + 6s duration + tappable Undo action.
- nav targets: Timeline (nav.go('timeline')) and Start (nav.go('start')).

## fidelityRisks

- COPY IS FROZEN + copy-lint tested. Do not paraphrase any string. 'No ads, no tracking' / 'Nothing shared without you tapping export' must remain literally true of the RN build or the honest-claims copy-lint fails.
- 'clears everything' / 'Delete everything in one tap' vs actual resetAll(): resetAll RESEEDS demo transactions — it does not leave an empty store. On RN, make resetAll truly clear OR the copy is a false claim. Confirm before ship.
- Melo mood='soft' is NOT a canonical mood; MELO_MOODS maps Privacy to 'calm'. Pick one, align mood map + component.
- The accent word 'your call.' is upright (not-italic) in --accent, NOT the usual Fraunces italic. Easy to mis-port in nested RN <Text>.
- Header centering relies on a 20px invisible spacer (w-5) balancing the back arrow so 'Your data' stays centered; reproduce with an equal-width spacer, not textAlign:center.
- Primary button uses a warm terracotta drop shadow rgba(224,99,58,0.55) (0 12px 24px -10px). RN shadow differs iOS (shadow* props) vs Android (elevation) — the glow must survive on both.
- bg-[var(--positive)]/15 = 15% alpha tint of --positive, not a separate token. Compute alpha in RN; don't hardcode hex.
- Row divider is a SINGLE hairline between the two rows (divide-y), plus the card's own 1px hairline border. Don't add a divider above row 1 or below row 2.
- Use StyleSheet.hairlineWidth for borders, not 1px, so they read at high DPR.
- The toast Undo closes over a full state snapshot; after nav.go('start') unmounts this screen, the toast + Undo must still function (toast lives outside this screen's tree).
- Bottom flex-1 spacer pushes the Melo line down; verify it bottom-anchors without clipping on short viewports and respects safe-area inset at mb-6.
- press = scale 0.97 + haptic on every tappable; keep the haptic on the destructive Start fresh row too.
- slide-in-r must collapse to final state instantly under reduce-motion (AccessibilityInfo.isReduceMotionEnabled), not run slower.
- No COPY_DECK keys yet — migrate all literals into the deck first; shipping inline strings violates the single-source rule and skips copy-lint.

## rnPrimitiveMap

- div → View
- button → Pressable (+ accessibilityLabel for ← back; + expo-haptics selectionAsync on press)
- span / h2 / p / em → Text (nested Text for the accent 'your call.' span)
- CSS vars (--accent etc.) → theme object + useTheme() hook (no hardcoded colors)
- Melo web SVG kit → react-native-svg Melo + reanimated breathe; size 28, mood resolved
- sonner toast → RN toast/snackbar (title + description + 6000ms + Undo action)
- .slide-in-r → reanimated entering (translateX → 0, ~240-360ms, cubic-bezier .16,1,.3,1)
- .press → Pressable pressed scale 0.97 + Haptics
- hairline utility / divide-y → StyleSheet.hairlineWidth borders (card border + one inter-row divider)
- bg-[var(--positive)]/15 → rgba(theme.positive, 0.15)
- box-shadow (button) → iOS shadow* props / Android elevation (terracotta glow)
- rounded-2xl → borderRadius 24 (--radius-xl)
- font-display → embedded Fraunces; body → Inter Tight / SF Pro / Roboto
- leading-relaxed / leading-[1.05] → numeric lineHeight
- max-w-[300px] → maxWidth:300
- flex-1 spacer → View flex:1
- nav.go/back/openSheet → @react-navigation stack (back, navigate Timeline/Start, present share BottomSheetModal)
- uppercase tracking-[0.14em] → textTransform:'uppercase' + letterSpacing

## stateBranches

- populated — the ONLY designed state. Per STATES.md, Privacy is populated-only.
- offline — visually identical to populated (no network dependency; local-first). No offline banner.
- empty / loading / error — n/a; this screen never fetches and has no async path. The two actions are synchronous local store mutations.
- transient post-action: after Start fresh → navigate to Start + 6s toast with Undo (handled by toast layer + nav, not an in-screen branch).

