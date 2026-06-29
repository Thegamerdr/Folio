# RouteDetailSheet  (C:/dev/folio-melo/.claude/worktrees/design-main/src/components/folio/sheets/SheetRouteDetail.tsx)

## file

C:/dev/folio-melo/.claude/worktrees/design-main/src/components/folio/sheets/SheetRouteDetail.tsx

## rnComponentName

RouteDetailSheet

## purpose

Detail for a point on the money path — what's left after a bill day, what's counted, what's waiting. Opened when the user taps a point on the path-to-payday on Today/Visualizer. Read-only sheet; its one action bridges the user to that day on the Calendar.

## reads

- useAppStore((s) => s.pots) — the pots list (Pot: { id, name, saved, goal, perWeek, accent, cadence? }); derives activePots = pots.filter(p => p.perWeek > 0)
- nav.pressure (Pressure: safe|calm|soft|pressured|overspent) — drives the 'Left after this' figure via pressureLow[nav.pressure] and Melo mood via pressureMood[nav.pressure]
- @reads doc block: nav.pressure (mood line) + the tapped point. In RN the tapped point (event date + its bills/amounts) MUST be passed in as props — the prototype HARDCODES the event (ROUTE_POINT_ISO='2026-07-01', four bills, implied −£858 total, '1 Jul' label); these are placeholders, not store reads.

## writes

- setCalendarFocusDate(ROUTE_POINT_ISO) — sets ephemeral calendarFocusDate bridge (setPartial({calendarFocusDate})) so ScreenCalendar jumps to that day then clears it
- onClose() — closes the sheet (caller-owned)
- nav.go('calendar') — navigates to Calendar after closing
- No money-data mutations (@writes: —). Only the calendar-focus bridge + navigation.

## opensSheets



## copyKeys

- NOTE: this sheet's copy is NOT in COPY_DECK.md — it is hardcoded + marked @copy FROZEN; RN must add keys before shipping. Exact strings:
- Eyebrow: "What's happening · 1 Jul" (date dynamic per tapped point)
- Close glyph: "×"
- Headline: "Set aside for bills" (no <em> accent word)
- Label: "Left after this"
- Label: "Bills counted"
- Bill rows (placeholder data): "Octopus Energy"/"1 Jul", "Council Tax"/"1 Jul", "Rent"/"1 Jul", "BT Broadband"/"3 Jul"
- Pots section label: "Pots · saved each Friday"
- Per-pot cadence label: "Friday" (placeholder — RN derives from pot.cadence)
- Melo line (Fraunces italic, quoted): "The lowest balance comes just after the bills go out."
- Primary CTA: "See this day on the calendar"
- Secondary CTA: "Close"
- Money values via <Money>: formatGBP(pressureLow[pressure]) e.g. "£325"; "−£858" (billsTotal .toFixed(0)); per-bill "−£118.40"/"−£162.00"/"−£540.00"/"−£38.00" (.toFixed(2)); pots header "−£70/wk"; per-pot "−£35"/"−£20"/"−£15"
- Use U+2212 '−' minus glyph (matches formatGBP + literals), never ASCII '-'.

## tokens

- --paper (sheet body bg, via Sheet)
- --surface (inner detail card bg)
- --accent #E0633A (pot dot, primary CTA bg, Melo blush/worry-bead)
- --positive (declared in @tokens; not in JSX directly, available via Money tone)
- --hairline #ECE9E0 (card border + pots-section top border)
- --negative #C5503E (bill dot, 'Bills counted' + pots-header Money tone='negative')
- --muted-ink #6B6760 (eyebrow, labels, close glyph, secondary CTA, dates)
- --ink #1A1815 (scrim 45%, default text, Melo outline)
- white #FFFFFF (primary CTA text)
- font-display = Fraunces (headline, Money, Melo line); tabular = font-variant-numeric tabular-nums (Money)
- radius: rounded-2xl (--radius-2xl 32px) on card + CTAs; Sheet top radius 28px
- shadow: --shadow-sheet (via Sheet)

## motions

- sheet-rise (480ms cubic-bezier(.16,1,.3,1)) — sheet enters (Sheet primitive)
- scrim-in (320ms ease-out, scrim 45% ink) — Sheet primitive
- press (120ms, scale 0.97 on :active) — close glyph, primary CTA, secondary CTA
- pebble-breathe / pebble-breathe-slow — Melo idle breathe (concern→breathe-slow); always-on
- Melo blink + mood-pulse (520ms on mood change) — Melo atom
- NO count-up: Money values are STATIC here (no useCountUp). Match prototype — don't add ticking.
- Reduced motion: collapse to final state (AccessibilityInfo.isReduceMotionEnabled).

## moods

- Melo mood = pressureMood[nav.pressure]: safe→calm, calm→calm, soft→soft(→calm in Melo), pressured→alert(→concern), overspent→alert(→concern)
- Aliases 'soft'→calm, 'alert'→concern are normalized inside Melo; RN_PORT/kit: DO NOT carry aliases into RN — map pressure directly to canonical 5 moods. Reachable here: calm + concern.
- Melo size = 28 (default companion tier).
- pose = 'none' (no pose passed). concern is never alarming (no red/shake) per MELO_MOODS.

## enginesNeeded

- Pot engine — supplies pots (perWeek/cadence). Sheet reads only; RN must derive real per-pot cadence label (not hardcoded 'Friday').
- Money path engine — supplies the tapped point: which day, the real 'left after this' balance, and the bills/pots around it. Prototype FAKES all of it (ROUTE_POINT_ISO, 4 bills, £858, pressureLow lookup). RN passes real per-point data via props.
- Calendar bridge (store) — setCalendarFocusDate + Calendar's consume-once-and-clear; React Navigation for nav.go('calendar').
- Cycle/bills data — the bill items (name, date, amount) landing on/near the point.
- NOT needed: statement/photo/text reader, insights, subscription detector, nudge scheduler.

## fidelityRisks

- HARDCODED EVENT DATA: date (1 Jul / ROUTE_POINT_ISO), the four bills, billsTotal £858, and 'Friday' pot cadence are placeholders — doc block + inline comment say RN MUST replace with the real tapped-point event passed in. Shipping the literals is a bug, not a port.
- 'Left after this' uses pressureLow[nav.pressure] (synthetic demo curve: safe 612/calm 325/soft 184/pressured 42/overspent −86), NOT a real per-point balance. RN must compute the actual remaining balance at the point.
- Per-pot label hardcoded 'Friday' + header 'saved each Friday', but Pot.cadence is a union (after-payday/weekly/monthly/custom). RN must derive wording; default new pots to after-payday.
- Minus sign is U+2212 '−' (in formatGBP and the `−£` literals), not ASCII '-'. Preserve glyph + tabular alignment.
- activePots filter = perWeek > 0; with the real cadence model perWeek may be 0 for non-weekly pots and wrongly hide them. RN should rethink the predicate (contributes within this point's window).
- Money is STATIC — don't reflexively add count-up; MOTION says money never slides and this sheet doesn't animate figures.
- COPY not in COPY_DECK yet (@copy FROZEN inline). Per COPY_DECK rule 'if a string isn't here it doesn't ship', RN must add eyebrow/headline/labels/Melo line/CTA keys; treat current strings as frozen source.
- Mood mapping must drop soft/alert aliases (kit + RN_PORT explicit). pressured/overspent → concern (breathe-slow + worry-bead, NEVER red/shake).
- Sheet body sits on --paper, NOT --surface (Sheet doc block); the inner card IS --surface — the paper-on-paper contrast is intentional.
- Headline has NO accent em word (unlike most Folio headlines). Reproduce as-is; don't invent one.
- Two-CTA shape (primary 'See this day on the calendar' + 'Close') honors STATES 'one CTA per state, refusal always available' — don't add a third action.
- Sheet content must scroll inside (BottomSheetScrollView), cap ~82% height, and respect safe-area/gesture inset around the CTAs.

## stateBranches

- populated (happy path) — the only state the prototype renders: eyebrow + headline + detail card (Left-after / Bills-counted summary, bills list, optional pots block) + Melo line + two CTAs.
- conditional: activePots.length > 0 — renders 'Pots · saved each Friday' divider + per-pot rows; when no active pots, that block is omitted (bills-only card still renders).
- empty — N/A as a screen state (sheet, not screen; STATES.md covers screens). RN graceful 'nothing counted on this day' if the point has no items (design call; prototype assumes data present).
- loading — N/A (synchronous local read; no spinner).
- error — N/A (no fetch).
- offline — N/A / same as populated (local-first).
- Fidelity target = reproduce populated branch + the activePots conditional.

## docBlock

/**
 * @rn-sheet     RouteDetailSheet
 * @purpose      Detail for a point on the money path — left after, counted, waiting.
 * @reads        nav.pressure (mood line) + the tapped point
 * @writes       —
 * @copy         FROZEN
 * @tokens       --paper --accent --positive --hairline
 */

## rnPrimitiveMap

- <Sheet> → @gorhom/bottom-sheet BottomSheetModal (45% --ink scrim, 28px top radius, hairline grip, sheet-rise spring; body on --paper not --surface; ~82% max height, BottomSheetScrollView)
- <div flex/space-y/gap> → <View> flexDirection/justify/align + gap or marginVertical for space-y
- <button onClick press> → <Pressable> + expo-haptics selectionAsync(); replicate .press scale-0.97 via reanimated on pressIn/out
- <Money> → <Text style={{ fontFamily:'Fraunces', fontVariant:['tabular-nums'] }}> with size map (sm=15/md=20/lg=28) + tone map (ink/positive/negative/muted/accent)
- formatGBP / .toFixed → keep identical JS; preserve U+2212 '−'
- <Melo mood> → react-native-svg + reanimated (breathe/blink/mood-pulse); five SVG moods; NO Lottie; drop soft/alert aliases
- CSS tokens → theme object + useTheme()/makeStyles (kitTheme pattern); supports dark via :root.dark
- hairline border → StyleSheet.hairlineWidth with --hairline
- colored dots (w-1.5 h-1.5 rounded-full) → <View> 6px square, borderRadius 3, bg token
- '×' + text CTAs → <Pressable><Text> (no native button chrome)
- nav.go(...) → @react-navigation/native navigation.navigate('Calendar')
- fixed px font sizes (11/13/26) → RN fontSize numbers; set lineHeight explicitly (leading-tight/snug)
- tracking-[0.14em]/[0.12em] → letterSpacing in points (≈ fontSize×em) + textTransform 'uppercase'
- italic Fraunces Melo line → Fraunces-Italic face + fontStyle 'italic'

## componentTree

<RouteDetailSheet onClose nav point={tappedPoint}>  // RN: point carries iso + bills + label
  <Sheet onClose title="What's happening">           // gorhom: --paper bg, 28px top radius, 45% ink scrim, grip
    <Row justify="space-between" align="center">
      <Eyebrow>What's happening · {point.dateLabel}</Eyebrow>   // 11px upper, tracking .14em, muted
      <PressableGlyph onPress={onClose}>×</PressableGlyph>     // muted, 18px, press
    </Row>
    <Headline mt={2}>Set aside for bills</Headline>           // font-display 26px leading-tight

    <Card mt={5} bg="surface" hairline radius="2xl" p={5}>
      <Row align="baseline" justify="space-between">
        <Col>
          <Label>Left after this</Label>                      // 11px upper tracking .12em muted
          <Money value={formatGBP(pressureLow[nav.pressure])} size="lg" />
        </Col>
        <Col align="end">
          <Label>Bills counted</Label>
          <Money value={`−£${billsTotal.toFixed(0)}`} size="md" tone="negative" />
        </Col>
      </Row>
      <Col mt={5} gap={3}>                                    // bills list
        {point.bills.map(b =>
          <Row key={b.name} align="center" justify="space-between" textSize={13}>
            <Row align="center" gap={2.5}>
              <Dot color="negative" />                        // 6px round --negative
              <Text>{b.name}</Text>
              <Text muted size={11.5}>{b.date}</Text>
            </Row>
            <Money value={`−£${b.amount.toFixed(2)}`} size="sm" />
          </Row>
        )}
      </Col>
      {activePots.length > 0 && (
        <>
          <Row mt={5} pt={4} borderTop="hairline" align="baseline" justify="space-between">
            <Label>Pots · saved each Friday</Label>
            <Money value={`−£${potsTotal.toFixed(0)}/wk`} size="sm" tone="negative" />
          </Row>
          <Col mt={3} gap={3}>
            {activePots.map(p =>
              <Row key={p.id} align="center" justify="space-between" textSize={13}>
                <Row align="center" gap={2.5}>
                  <Dot color="accent" />                      // 6px round --accent
                  <Text>{p.name}</Text>
                  <Text muted size={11.5}>Friday</Text>        // RN: derive from p.cadence
                </Row>
                <Money value={`−£${p.perWeek.toFixed(0)}`} size="sm" />
              </Row>
            )}
          </Col>
        </>
      )}
    </Card>

    <Row mt={5} align="flex-start" gap={3}>                   // Melo line
      <Melo size={28} mood={pressureMood[nav.pressure]} />
      <Text flex={1} size={13} fontDisplay italic>
        "The lowest balance comes just after the bills go out."
      </Text>
    </Row>

    <PrimaryButton mt={5} h={54} radius="2xl" bg="accent" color="white"
      onPress={seeOnCalendar /* setCalendarFocusDate(iso)→onClose()→nav.go('calendar') */}>
      See this day on the calendar
    </PrimaryButton>
    <TextButton mt={2} h={48} radius="2xl" color="muted-ink" onPress={onClose}>
      Close
    </TextButton>
  </Sheet>
</RouteDetailSheet>

