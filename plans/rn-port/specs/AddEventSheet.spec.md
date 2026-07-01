# AddEventSheet (C:\dev\folio-melo\.claude\worktrees\design-main\src\components\folio\sheets\SheetAddEvent.tsx)

## file

C:\dev\folio-melo\.claude\worktrees\design-main\src\components\folio\sheets\SheetAddEvent.tsx

## rnComponentName

AddEventSheet

## purpose

Bottom sheet to add a single one-off manual money event to the calendar (the human explanation layer for the derived Route). Manual entries sit alongside derived paydays/bills/sub-renewals/deadlines. Local form, no async, no engine.

## docBlock

/\*\*

- @rn-sheet AddEventSheet
- @purpose Add a one-off money event to the calendar (the explanation
-               layer for the Route). Manual entries sit alongside derived
-               paydays, bills, sub renewals, and deadlines.
- @reads —
- @writes calendarEvents (via addCalendarEvent)
- @copy FROZEN
- @tokens --paper --accent --inset --hairline
  \*/

## reads

- — (none; doc block @reads is empty)
- Local component state only: date (default todayIso()), kind (default 'out'), title, amount, note
- Derived locals: canAdd = title.trim().length>0 && date.length===10; showAmount = kind==='in' || kind==='out'

## writes

- calendarEvents — via addCalendarEvent({ date, kind, title (trimmed), note (trimmed||undefined), amount (signed: kind==='out' => -abs, else +abs; undefined when not in/out or empty/NaN) })
- addCalendarEvent generates id, prepends to calendarEvents, caps list at 100; sheet never sets id
- onClose() called after a successful add and on cancel/scrim/× tap

## opensSheets

## copyKeys

- NOTE: this sheet's strings are NOT in COPY_DECK.md (the 'Add a thing' deck covers the statement/photo/paste/manual entry router, not this manual calendar-event sheet). Strings below are the exact literals in source and must be treated as the source of truth for the port.
- Sheet title (a11y, passed to <Sheet title>): "Add an event"
- Eyebrow: "Add to calendar" (uppercase, tracked)
- Close button glyph: "×" (aria-label "Close")
- Headline: "One thing on the day." — accent word "day." rendered in --accent (em, not-italic)
- Subhead (italic): "Quietly added to your calendar."
- Field label: "Kind"
- Kind option labels: "In", "Out", "Review", "Deadline"
- Kind hints (shown below the grid for the selected kind): in→"money lands", out→"money leaves", review→"something to check", deadline→"a date that matters"
- Field label: "Date"
- Field label: "What is it"
- Title placeholder: "e.g. Birthday gift"
- Field label: "Amount (optional)" (only when kind is in/out)
- Currency prefix glyph: "£"
- Amount placeholder: "0.00"
- Field label: "Note (optional)"
- Note placeholder: "A small reminder"
- Primary CTA: "Add to calendar"
- Secondary CTA: "Cancel"

## tokens

- --paper
- --accent
- --inset
- --hairline
- --muted-ink
- --ink
- --accent-soft
- (via Sheet primitive) shadow-sheet, scrim = --ink @ 45% opacity

## motions

- sheet-rise (480ms cubic-bezier(.16,1,.3,1)) — sheet body, from Sheet primitive
- scrim-in (320ms ease-out, to 45% ink) — from Sheet primitive
- press (120ms ease, scale 0.97 on :active) — all tappable: ×, kind chips, both CTAs

## moods

- No Melo on this surface. MELO_MOODS.md has no row for SheetAddEvent; rule 'No mood = no Melo' applies — do NOT add a Melo. (Adjacent reference only: 'Melo chat sheet' = calm; nearest conceptual neighbor would be calm, but this sheet ships with no Melo at all.)

## componentTree

<BottomSheetModal> (gorhom; 40% ink scrim, 28px top radius, --paper body, hairline grip; a11y label "Add an event")
<BottomSheetScrollView contentContainerStyle={{paddingH:24, paddingTop:8, paddingBottom:24}}>
<View flexRow justify="space-between" align="center">
<Text eyebrow uppercase tracking=0.14em color=muted-ink size=11>Add to calendar</Text>
<Pressable press onPress={onClose} a11yLabel="Close"><Text color=muted-ink size=18>×</Text></Pressable>
</View>
<Text fontDisplay size=26 mt=8 leading-tight>One thing on the <Text color=accent>day.</Text></Text>
<Text italic size=12.5 color=muted-ink mt=4>Quietly added to your calendar.</Text>

    <View mt=20 gap=16>
      {/* Kind */}
      <View>
        <Text label uppercase tracking=0.14em size=10.5 color=muted-ink>Kind</Text>
        <View mt=8 flexRow gap=6>  {/* 4-col, equal width */}
          {KINDS.map(k =>
            <Pressable press flex=1 radius=12 py=8 align=center
              a11yState={{selected: kind===k.id}}
              bg={kind===k.id ? accent-soft : inset}
              onPress={() => setKind(k.id)}>
              <Text size=12 weight=500 color={kind===k.id ? ink : muted-ink}>{k.label}</Text>
            </Pressable>)}
        </View>
        <Text italic size=10.5 color=muted-ink mt=6>{hint for selected kind}</Text>
      </View>

      {/* Date */}
      <View>
        <Text label …>Date</Text>
        <Pressable onPress={openDatePicker} mt=8 h=44 px=12 radius=12 bg=inset hairlineBorder>
          <Text size=13.5 tabularNums>{date}</Text>   {/* native date picker, NOT <input type=date> */}
        </Pressable>
      </View>

      {/* What is it */}
      <View>
        <Text label …>What is it</Text>
        <TextInput mt=8 h=44 px=12 radius=12 bg=inset hairlineBorder size=13.5
          value={title} onChangeText={setTitle} placeholder="e.g. Birthday gift" />
      </View>

      {/* Amount — only when kind in/out */}
      {showAmount &&
        <View>
          <Text label …>Amount (optional)</Text>
          <View mt=8 flexRow align=center gap=8>
            <Text color=muted-ink tabularNums size=14>£</Text>
            <TextInput flex=1 h=44 px=12 radius=12 bg=inset hairlineBorder size=13.5 tabularNums
              keyboardType="decimal-pad" value={amount} onChangeText={setAmount} placeholder="0.00" />
          </View>
        </View>}

      {/* Note */}
      <View>
        <Text label …>Note (optional)</Text>
        <TextInput mt=8 h=44 px=12 radius=12 bg=inset hairlineBorder size=13.5
          value={note} onChangeText={setNote} placeholder="A small reminder" />
      </View>
    </View>

    <Pressable press mt=24 h=54 radius=16 bg=accent center disabled={!canAdd} opacity={canAdd?1:0.4} onPress={handleAdd}>
      <Text color="#FFFFFF" weight=500 size=15>Add to calendar</Text>
    </Pressable>
    <Pressable press mt=8 h=44 radius=16 center onPress={onClose}>
      <Text size=13.5 color=muted-ink>Cancel</Text>
    </Pressable>

  </BottomSheetScrollView>
</BottomSheetModal>

## enginesNeeded

- No engine. Pure local form + one store write.
- store: addCalendarEvent (src/lib/store.ts:501) and the CalendarEvent type (kind: 'in'|'out'|'review'|'deadline'; amount signed pounds, positive=in/negative=out/undefined for review|deadline)
- RN store equivalent (SQLite/Drizzle/WatermelonDB per RN_PORT.md) must expose the same addCalendarEvent contract: generate id, prepend, cap-100 (or paginate), persist
- todayIso() local-date helper (Y-M-D, zero-padded) — reimplement in RN; note hydration caveat from STATES.md (new Date() differs SSR/client on web, but RN has no SSR so default date is safe)
- Downstream consumer (not this sheet): Calendar screen merges these manual calendarEvents with deriveCalendarEvents() — manual events are the only user-authored calendar rows

## fidelityRisks

- State branches: this is a form sheet with NO empty/loading/error/offline variants. It only ever renders the populated form. canAdd just disables the primary CTA (opacity 0.4 + non-press); there is NO inline validation message, NO error copy, NO toast. Do not invent error/loading states — STATES.md lists no row for this sheet.
- Conditional Amount field: the Amount block renders ONLY when kind is 'in' or 'out'. Switching to review/deadline must hide it; the entered amount value is kept in state (not cleared) but is ignored on add because showAmount gates the parse. Preserve this exact behavior.
- Amount sign logic is load-bearing: out => -Math.abs(amt); in => +Math.abs(amt); undefined when !showAmount, empty, or NaN. Don't store a raw signed user value — always abs() then sign by kind.
- Title is trimmed before write and is the gate for canAdd (after trim, length>0). Whitespace-only title must NOT enable add.
- date.length===10 is the only date validity check (matches YYYY-MM-DD). RN uses a native date picker, not a text input — ensure the picker yields a 10-char ISO Y-M-D string so canAdd stays satisfiable; never feed locale-formatted dates.
- Web uses <input type='date'> and <input type='number' inputMode='decimal' step='0.01'>. RN has neither: Date => native DateTimePicker (display the iso text in a Pressable styled identically); Amount => TextInput keyboardType='decimal-pad' (iOS) / 'numeric' (Android), no step semantics — accept free decimal text and parseFloat on add exactly as source.
- Kind selector is a 4-up equal-width grid (grid-cols-4 gap-1.5). RN: flexRow with flex:1 children + gap; keep the selected style (bg accent-soft + ink text) vs unselected (bg inset + muted-ink text). aria-pressed => accessibilityState={{selected}}.
- Hint line reads from KINDS.find(selected)?.hint — it must update live on kind change and sit directly under the grid (mt 1.5, italic, 10.5px, muted-ink).
- Accent word treatment: 'day.' is an <em class='not-italic text-accent'> — render upright (NOT italic) in --accent within the Fraunces/display headline. Easy to accidentally italicize.
- Typography: headline uses font-display (Fraunces) at 26px leading-tight; labels are 10.5px uppercase tracking 0.14em; body inputs 13.5px. Amount/£/date use tabular-nums (fontVariant tabular-nums in RN).
- Sheet body sits on --paper (not --surface) per Sheet doc block — 'paper lifting from paper'. Keep grip (9x3px, --hairline), 28px top radius, top-edge highlight, and the 45% ink scrim. max-h 82% on web => snapPoint roughly content-height capped; scrollable body.
- press utility on web is :active scale 0.97; in RN map to Pressable + expo-haptics Haptics.selectionAsync() on the tappables (× , kind chips, both CTAs) per RN_PORT.
- Two close paths besides Cancel: the × button and the scrim tap both call onClose; gorhom backdrop press + a × in the header must both wire to onClose.
- Copy is FROZEN and these strings are NOT yet in COPY_DECK.md — porting should add keys for them (e.g. addEvent.\* ) rather than hardcoding, but the visible text must match the literals exactly (banned-words check: none of the strings here use banned vocab; keep it that way).
- No Melo, no count-up, no route-draw, no verdict-stamp here — only sheet-rise/scrim-in/press. Don't add decorative motion or a mascot.

## stateBranches

- populated (the only branch): always renders the full form; this is the default and sole visual state
- implicit 'invalid/incomplete' (not a STATES.md branch): canAdd=false → primary CTA disabled (opacity 0.4, non-interactive); no error copy shown
- conditional sub-branch: Amount field present iff kind∈{in,out}, absent for {review,deadline}
- empty: n/a — sheet has no data dependency
- loading: n/a — synchronous, no async/engine
- error: n/a — addCalendarEvent cannot fail in-sheet; no error UI
- offline: n/a — local-first write, identical behavior

## rnPrimitiveMap

- <Sheet> (web div + scrim) -> @gorhom/bottom-sheet BottomSheetModal + BottomSheetScrollView (40% ink scrim/backdrop, 28px top radius, --paper body, 9x3 hairline grip, sheet-rise spring)
- outer scroll div (no-scrollbar, max-h calc) -> BottomSheetScrollView with hidden indicators
- <button> (×, kind chips, CTAs) -> Pressable + expo-haptics selectionAsync; web 'press' class -> animated scale 0.97 / haptic
- <input type='date'> -> native DateTimePicker (@react-native-community/datetimepicker) behind a Pressable showing the iso string (tabular-nums)
- <input type='text'> (title, note) -> TextInput
- <input type='number' inputMode='decimal' step=0.01> -> TextInput keyboardType='decimal-pad'/'numeric' (no step)
- CSS var colors (--paper/--accent/--inset/--hairline/--muted-ink/--ink/--accent-soft) -> theme object + useTheme() hook
- hairline utility (1px --hairline border) -> StyleSheet.hairlineWidth border with theme.hairline color
- tabular class (font-variant tabular-nums) -> <Text style={{fontVariant:['tabular-nums']}}>
- font-display (Fraunces) -> embedded Fraunces family on the headline; em.not-italic.text-accent -> upright Text in theme.accent
- rounded-xl/2xl (12px/16px) -> borderRadius from radius scale (radius-md 12, radius-lg 18; CTA uses rounded-2xl≈16)
- uppercase tracking-[0.14em] labels -> Text textTransform:'uppercase', letterSpacing≈1.5
- aria-pressed -> accessibilityState={{selected}}; aria-label -> accessibilityLabel; role='dialog'/aria-modal handled by bottom-sheet
- disabled:opacity-40 -> disabled prop + style opacity 0.4
- nav/close (onClose prop) -> parent dismisses the gorhom modal (ref.dismiss()) / navigation goBack
