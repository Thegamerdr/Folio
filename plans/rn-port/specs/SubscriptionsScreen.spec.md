# SubscriptionsScreen (C:\dev\folio-melo\.claude\worktrees\design-main\src\components\folio\screens\ScreenSubscriptions.tsx)

## file

C:\dev\folio-melo\.claude\worktrees\design-main\src\components\folio\screens\ScreenSubscriptions.tsx

## rnComponentName

SubscriptionsScreen

## purpose

Subscription pulse — for each recurring charge show a usage pulse (yes/maybe/no), worst-value/cost/next-charge sort, and per-item actions: pause for a month / resume, mark used today, ask Melo, cancel. Surfaces a monthly+yearly total (with savings-from-pauses) and a "quiet 3" batch-pause recommendation that quantifies the tight-day lift before the user commits. Voice is FROZEN: "What still earns its place?"

## reads

- subs
- subPaused
- subOverrides
- pots
- onboarding
- calendarEvents
- getState().subs
- getState().subPaused

## writes

- togglePaused
- pauseMany
- markSubUsed
- removeSub
- setSubs

## opensSheets

- melo-chat

## copyKeys

- subs.title ("Subscriptions")
- subs.empty.head ("No subs **yet.**")
- subs.empty.cta ("Add a subscription")
- LITERAL "Recurring spend"
- LITERAL "What still earns its place?"
- LITERAL empty body (diverges from COPY_DECK subs.empty.body)
- LITERAL "Every month" / "Per year"
- LITERAL "−£{n} from pauses"
- LITERAL "A quiet move"
- LITERAL "Pause the {n} quiet ones → save £{x}/mo, £{y}/yr"
- LITERAL "Your low point: £{a} → £{b} ({day})"
- LITERAL sort chips "Worst value"/"Cost"/"Next charge"
- LITERAL pulse labels "Used recently"/"Not sure"/"Quiet a while"
- LITERAL "Trial ends today"/"Trial ends in {n}d"
- LITERAL score "{p}p per use · {n}/mo" / "no uses this month"
- LITERAL next "today"/"tomorrow"/"in {n}d"/date
- LITERAL "Pause for a month"/"Resume"/"Used today"/"Ask Melo"/"Cancel"
- LITERAL toasts: "Your low point goes from £{a} to £{b}", "£{c} back on {day}", "Paused {name}", "Cancelled {name}" + "Re-add any time."/"Undo"
- LITERAL footer "Pausing for a month is a small experiment. You can always resume."
- LITERAL Ask-Melo prefill "Talk me out of {name} (£{cost}/mo, {n} uses last month)."

## tokens

- --surface
- --hairline
- --accent
- --accent-soft
- --positive
- --muted-ink
- --ink
- --paper
- --inset
- --caution
- --negative

## motions

- slide-in-r
- press
- count-up (useCountUp on £ monthly total)
- pebble-breathe (footer MeloLine)
- transition-opacity (paused row fades to 0.55)

## moods

- calm — empty state EmptyState mood="calm" (MELO_MOODS: Subs empty = calm)
- soft — footer MeloLine mood="soft" (NOT one of the 5 canonical moods calm|curious|cheer|concern|celebrate; rare expression — RN Melo must support 'soft' or map to calm)
- populated screen has no top-anchor Melo, only the footer line (MELO_MOODS: 'No mood = no Melo')

## docBlock

/\*\*

- @rn-screen SubscriptionsScreen
- @rn-stack MainTabs > Subs
- @purpose Subscription pulse — pause / cancel / used-today / ask-Melo per item.
- @reads subs, subPaused
- @writes togglePaused, removeSub, markSubUsed
- @opens-sheet melo-chat
- @copy FROZEN — "still earns its place" voice.
- @tokens --surface --hairline --accent --positive --muted-ink
- @motion press · slide-in-r · subtle pulse on the "used today" tick
  \*/

## componentTree

<![CDATA[
// EMPTY BRANCH (subs.length === 0)
<View style={{flex:1, px-7, pt-4}} entering={slideInR}>      // h-full flex-col
  <View row spaceBetween>                                   // header
    <Pressable onPress={nav.back}><Text muted 20px>←</Text></Pressable>
    <Text muted 12px uppercase tracking0.14em>Subscriptions</Text>
    <View w-5 />                                            // spacer
  </View>
  <View mt-5>
    <Text fontDisplay italic 13px muted>Recurring spend</Text>
    <Text fontDisplay 28px lh1.05 mt-1>What still <Text accent normal>earns</Text> its place?</Text>
  </View>
  <View mt-6>
    <EmptyState mood="calm"
      headline={<>No <Text accent normal>subs</Text> yet.</>}
      body="Add a streaming service, gym, or anything that comes out every month. You'll see what still earns its place."
      cta={{ label: "Add a subscription", onPress: () => nav.go("add-debt") }} />
  </View>
</View>

// POPULATED BRANCH
<ScrollView style={{flex:1, px-7, pt-4}} showsVerticalScrollIndicator={false} entering={slideInR}>
  <View row spaceBetween> {/* same header */} </View>
  <View mt-5> {/* same eyebrow + headline */} </View>

  {/* TOTAL CARD */}
  <View mt-5 bg-surface hairline rounded-2xl p-5 row alignBaseline spaceBetween>
    <View>
      <Text 11px uppercase tracking0.12em muted>Every month</Text>
      <Animated.Text fontDisplay tabular 34px lh-none mt-1>£{monthlyDisplay.toFixed(2)}</Animated.Text>  // count-up
      {monthlySaved>0 && <Text 11.5px positive mt-1 tabular>−£{monthlySaved.toFixed(2)} from pauses</Text>}
    </View>
    <View alignEnd>
      <Text 11px uppercase tracking0.12em muted>Per year</Text>
      <Text fontDisplay 15px tabular mt-0.5>£{(monthly*12).toFixed(0)}</Text>
    </View>
  </View>

  {/* QUIET-MOVE CTA — only if quietOnes.length>0 && !quietPaused */}
  {showQuietMove && (
    <Pressable onPress={pauseQuietOnesWithToast}
      mt-3 fullWidth bg-accent-soft ring-1(accent/30) rounded-2xl px-4 py-3 row gap-3 alignCenter>
      <View flex-1>
        <Text 11.5px uppercase tracking0.12em accent>A quiet move</Text>
        <Text 13px mt-0.5 ink>Pause the {n} quiet ones → save £{quietSave}/mo, £{quietSave*12}/yr</Text>
        {quietLift>0 && tightIfQuietPaused?.date &&
          <Text 11.5px mt-1 positive tabular>Your low point: £{tightWith.spare} → £{tightIfQuietPaused.spare} ({formatDayProse(date)})</Text>}
      </View>
      <Text accent 18px>→</Text>
    </Pressable>
  )}

  {/* SORT CHIPS */}
  <View mt-4 row gap-1.5>
    {["value","cost","next"].map(k =>
      <Pressable onPress={()=>setSort(k)} h-7 px-3 rounded-full
        style={sort===k ? {bg:ink, text:paper} : {bg:inset, text:muted}}>
        <Text 11px>{k==="value"?"Worst value":k==="cost"?"Cost":"Next charge"}</Text>
      </Pressable>)}
  </View>

  {/* LIST CARD — hairline-divided rows */}
  <View mt-3 bg-surface hairline rounded-2xl>          // divide-y hairline between rows
    {sorted.map(s => (
      <View key={s.name} px-5 py-4 style={{opacity: isPaused?0.55:1}}>
        <View row alignCenter gap-3>
          <View w-2 h-2 rounded-full bg={pulseDot(p)} />        // pulse dot (positive/caution/negative@70)
          <View flex-1 minW-0>
            <View row alignCenter gap-2>
              <Text 14.5px medium numberOfLines={1}>{s.name}</Text>
              {hasTrial && !isPaused &&
                <Text 9.5px uppercase tracking0.12em px-1.5 py-0.5 rounded-full bg-caution/15 text-caution tabular
                  accessibilityLabel="Free trial about to convert into a paying charge">
                  Trial ends {trialEndsInDays===0?"today":`in ${trialEndsInDays}d`}</Text>}
            </View>
            <Text 11.5px muted mt-0.5 tabular numberOfLines={1}>{pulseLabel(p)} · {formatScore(s)}</Text>
          </View>
          <View alignEnd>
            <Text fontDisplay tabular 15px>£{s.cost.toFixed(2)}</Text>
            <Text 10.5px muted tabular mt-0.5>next {formatNext(s.nextRenewalDaysAway)}</Text>
          </View>
        </View>
        <View mt-3 row alignCenter gap-2>
          <Pressable onPress={onPauseResume} h-8 px-3 rounded-full bg-inset><Text 12px ink>{isPaused?"Resume":"Pause for a month"}</Text></Pressable>
          {!isPaused && <Pressable onPress={()=>markSubUsed(s.name)} h-8 px-3 rounded-full accessibilityLabel="Mark as used today"><Text 12px positive>Used today</Text></Pressable>}
          <Pressable onPress={()=>nav.openMelo({prefill})} h-8 px-3 rounded-full><Text 12px muted>Ask Melo</Text></Pressable>
          <Pressable onPress={cancelWithUndo} h-8 px-3 rounded-full marginLeft="auto"><Text 12px negative>Cancel</Text></Pressable>
        </View>
      </View>
    ))}
  </View>

  <View mt-5 mb-8>
    <MeloLine mood="soft" text="Pausing for a month is a small experiment. You can always resume." />
  </View>
</ScrollView>
]]>

## enginesNeeded

- @/lib/store: useAppStore (external store) + actions pauseMany, togglePaused, markSubUsed, removeSub, setSubs, getState; Sub type { name, cost, nextRenewalDaysAway, lastUsedDaysAgo, usesPerMonth, trialEndsInDays? }
- @/lib/calendar-events MONEY-PATH ENGINE: deriveCalendarEvents({ subs, subPaused, subOverrides, onboarding, manualEvents:calendarEvents, pots, windowDays:35, now }) → groupByDay(events) → computeSpareAndTightest(grouped, 720) → { tightestSpare, tightestDate }; formatDayProse(iso). RN_PORT.md 'Money path engine' — deterministic, local; RN app must own it.
- kit: MeloLine, EmptyState, useCountUp, Melo (5-mood SVG → react-native-svg + reanimated breathe)
- toast: sonner → RN toast lib (burnt / react-native-toast-message) with description + duration + action {label,onPress}
- In-component pure derivations (no engine): pulseOf (usesPerMonth/lastUsedDaysAgo → yes/maybe/no), valueScore (pence-per-use; 0 uses → Infinity), sorted (useMemo by value/cost/next), monthly/totalIfNoPause/monthlySaved sums, quietOnes/quietSave/quietPaused, formatScore, formatNext, pulseDot/pulseLabel
- now: Date set in useEffect on mount — hydration guard so tight-day spare figures don't render before client mount

## fidelityRisks

- @motion doc-block promises a 'subtle pulse on the used today tick' the source does NOT implement ('Used today' is a plain press button). Decide intentionally: add the pulse in RN (closer to doc) or match source (none) — don't silently drop.
- Empty body copy DIVERGES from COPY_DECK subs.empty.body ('Folio will spot recurring charges as you add statements.'); source uses a longer literal. RN_PORT requires every string live in COPY_DECK — reconcile, don't invent a third variant.
- Footer MeloLine mood='soft' is NOT a canonical mood (calm|curious|cheer|concern|celebrate). Verify RN Melo supports 'soft' (rare soft-eye expression) or map to calm.
- Empty-state CTA navigates to 'add-debt' (not an add-subscription route) — verify the RN route id; a mismatched target is a silent break.
- Tight-day engine runs TWICE per render (tightWith + tightIfQuietPaused) plus a 3rd inline call on every per-item pause. Heavy in RN — keep useMemo, never call deriveCalendarEvents in a render hot path unmemoized.
- Hydration guard (now===null until useEffect) is load-bearing: skip it and tight-day figures render wrong/zero on first frame and flicker. Reproduce it; gate lift lines + toast-with-lift on now!==null.
- Money must stay tabular + £ literal (banned '12.3K'): fontVariant:['tabular-nums'] on every £ figure (total, per-year, savings, per-item cost, all toasts).
- Headline accent word uses not-italic override on the italic display face — nested RN Text must set fontStyle:'normal' + accent color or it renders italic.
- divide-y hairline inside rounded-2xl card: RN needs per-row borderBottomWidth: StyleSheet.hairlineWidth (skip last) within a clipped rounded container or borders bleed past the radius.
- Cancel→Undo restores BOTH subs (setSubs) AND paused state (togglePaused(name,true)) from a snapshot taken BEFORE removeSub — capture order matters; RN toast must support an action callback.
- Sort 'value' uses Infinity sentinel (zero-use = worst); comparator b−a with Infinity is fine but guard NaN.
- press is purely visual scale on web; adding expo-haptics to all 4 row buttons + 3 chips feels noisy against Folio's quiet tone — gate haptics to meaningful actions (pause/cancel).
- No hero Melo on the populated screen — only the footer line. Don't add one (MELO_MOODS: 'No mood = no Melo').
- Reduced motion (AccessibilityInfo.isReduceMotionEnabled): count-up, slide-in-r, breathe collapse to final state, not slowed.
- Alpha tokens bg-[var(--negative)]/70, bg-caution/15, ring-accent/30 have no RN util — convert to rgba with explicit alpha from the theme color.
