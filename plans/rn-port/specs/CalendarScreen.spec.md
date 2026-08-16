# CalendarScreen (C:/dev/folio-melo/.claude/worktrees/design-main/src/components/folio/screens/ScreenCalendar.tsx)

## file

C:/dev/folio-melo/.claude/worktrees/design-main/src/components/folio/screens/ScreenCalendar.tsx

## rnComponentName

CalendarScreen

## purpose

The time view of money — the explanation layer for the Route. Three planner views (Month / Week / Agenda) over one shared derived timeline. Shows what lands and what leaves each day, surfaces the lowest spare-£ point, and lets the user nudge/pause sub renewals and move/remove manual events. Bridges both directions with the Route on Today.

## reads

- subs
- subPaused
- subOverrides
- onboarding
- calendarEvents (aliased manual)
- calendarFocusDate (aliased focusDate)
- pots
- local: today (hydration gate useState<Date|null>)
- local: view ('month'|'week'|'agenda', default 'agenda')
- local: jumpDate, jumpPulse (cross-view scroll trigger)
- local per-subview: offset (week/month), selected (month), hover (SubRenewalActions)

## writes

- removeCalendarEvent(id) — manual event Remove
- updateCalendarEvent(id, { date: shiftIso(e.date, -1|+1) }) — manual event Move ±1d
- setCalendarFocusDate(null) — consume+clear the Route→Calendar bridge once
- setRouteFocusDate(iso) — Calendar→Route bridge (SeeOnRoute) then nav.go('today')
- togglePaused(name, true) — Pause this sub renewal
- nudgeSub(name, ±1|±3) — move a sub renewal, clamped ±7d, writes subOverrides
- resetSubOverrides(name) — clear a sub nudge

## opensSheets

- add-event
- calendar-export
- calendar-connect
- route-detail (in @opens-sheet doc block; not invoked in this file — opened from the Route side, paired via setCalendarFocusDate/SeeOnRoute bridges)

## copyKeys

- DOC BLOCK @copy = FROZEN. COPY_DECK.md has NO Calendar section — every string is frozen INLINE. Per RN_PORT.md ('if a string isn't here, it doesn't ship') add a calendar.\* namespace before RN ship. Verbatim strings:
- What's coming
- Calendar
- Your week, with what's coming and going. (accent word = coming and going.)
- Each day, what lands and what leaves.
- month / week / agenda
- Lowest point:
- £{n} left (tightest pill, after formatDayProse(date) · )
- Go there →
- Money in / Money out / Review / Deadline (legend = KIND_LABEL minus manual)
- - Add an event
- Add to your calendar app
- Connect Google
- £{n} left after (agenda spare)
- £{n} left (week day-block spare)
- past (agenda past marker, italic)
- See this day on your money path
- What's left this week
- low £{n} · high £{n}
- Previous week / Next week (aria)
- Spare across the month
- low £{n}
- Previous month / Next month (aria)
- Nothing moves your money on this day. (italic)
- M T W T F S S
- you added this (manual badge) + sr-only 'You added this'
- Repeats monthly / Repeats yearly (↻)
- Move
- −1d / +1d (manual); −3d / −1d / +1d / +3d (sub)
- Remove
- Pause this
- Reset
- would free up £{n} on your lowest day / would cost £{n} on your lowest day / no change to your lowest day
- Nudged {±n}d from its usual day
- EmptyState: default 'Nothing pulling at your money this week.' / 'Add a payday or a bill below to start the picture.'; payday 'No payday set yet.' / 'Add your payday so Folio knows when money lands.'; bills 'Nothing leaving yet.' / 'Add a bill or two so Folio knows what's leaving.'; pots 'No saving rhythm yet.' / 'Add a pot below to see how weekly savings shape your dips.'
- Melo bands (meloCalendarLine): empty 'Nothing pulling at your money this week.'; tight<=0 'The middle of the month runs short. Let's move something together.'; tight<50 'There's a pinch coming. We can soften it together.'; tight<200 'A squeeze in the middle — but you should make it through.'; else 'Quiet on most days. A few that matter.'
- sr-only kind labels (KIND_LABEL): Money in, Money out, Review, Deadline, You added this
- BANNED-WORD CHECK: inline strings are clean (no sync/dashboard/extract/etc.) — keep clean when adding to COPY_DECK.

## tokens

- --paper
- --surface
- --inset
- --ink
- --muted-ink
- --hairline
- --accent
- --accent-soft
- --positive
- --negative
- --caution
- white #FFFFFF (Add-event CTA text → --color-primary-foreground)
- --ink/60 (KIND_DOT.manual)
- --paper/70 (month selected-day dots & tick)
- radius rounded-xl(12)/rounded-2xl(32 token)
- shadow-[0_1px_2px_rgba(0,0,0,0.04)] (active tab)
- font-display Fraunces (headline, kicker, month label, EventRow amount)
- tabular tabular-nums (all £ figures, day numbers, low/high)

## motions

- slide-in-r (screen root: translateX 28→0, 360ms, cubic-bezier(.16,1,.3,1))
- scale-in (tightest pill: scale .97→1 + opacity, 320ms)
- press (every tappable: scale→0.97, 120ms → Pressable + Haptics.selectionAsync)
- soft view crossfade (doc @motion: cross-fade body on tab switch, never reload data)
- smooth scrollIntoView block:center (agenda jump → RN scrollTo measured y, animated)
- transition-opacity (past-day dimming; static under reduced motion)
- transition-colors (active tab swap)
- Melo breathe/blink continuous via MeloLine (mood-dependent rhythm)
- REDUCED MOTION: all collapse to final state instantly

## moods

- calm (tightestSpare >= 200 and not empty)
- soft (empty OR tightestSpare in [50,200))
- alert (tightestSpare < 50 and not empty)
- MAPPING NOTE: meloCalendarMood returns calm|soft|alert but Melo's vocabulary is calm|curious|cheer|concern|celebrate. RN map soft→curious, alert→concern (copy carries meaning; mood decorative). Calendar absent from MELO_MOODS.md — document the mapping when wiring.

## componentTree

CalendarScreen(nav):
// Hydration gate: today===null → skeleton (header + title + empty flex-1 surface-hairline rounded-2xl card), no spare £.
<ScrollView root style=slide-in-r px-28 pt-16 noScrollbar>

<Header row between>
<Pressable onPress=nav.back aria-label=Back>←</Pressable>
<Text eyebrow upper tracking.14>What's coming</Text>
<Spacer w-5/>
</Header>
<TitleBlock mt-5>
<Text display italic 13 muted>Calendar</Text>
<Text display 28>Your week, with what's <Em accent notItalic>coming and going.</Em></Text>
<Text 12.5 muted mt-1>Each day, what lands and what leaves.</Text>
</TitleBlock>
<ViewSwitcher role=tablist mt-5 grid3 gap-1 p-1 rounded2xl bg=inset hairline>
{["month","week","agenda"].map(v => <Tab role=tab aria-selected={view===v} h-9 rounded-xl 12.5 capitalize
selected:{bg=paper text=ink shadow} else:{text=muted} onPress=setView(v)>{v}</Tab>)}
</ViewSwitcher>
{tightestDate && !isEmpty &&
<Pressable TightestPill onPress=jumpToTightest mt-4 w-full bg=accent-soft hairline rounded2xl px-4 py-3 style=scale-in row baseline between>
<Text 12.5 ink><Text accent medium>Lowest point:</Text> {formatDayProse(tightestDate)} · £{max(0,round(tightestSpare))} left</Text>
<Text muted 12 upper tracking.12 shrink-0>Go there →</Text>
</Pressable>}
<Body mt-5 flex-1>
{isEmpty ? <EmptyState missingPayday missingBills missingPots/>
: view==="agenda" ? <AgendaView/> : view==="week" ? <WeekView/> : <MonthView/>}
</Body>
<Legend mt-5 grid2 gap-2 11> // 4 rows: dot(positive/negative/accent/caution)+label
<FooterActions mt-5 grid3 gap-2>
<Pressable h-48 rounded2xl bg=accent textWhite medium onPress=openSheet('add-event')>+ Add an event</Pressable>
<Pressable h-48 rounded2xl bg=surface hairline onPress=openSheet('calendar-export')>Add to your calendar app</Pressable>
<Pressable h-48 rounded2xl bg=surface hairline onPress=openSheet('calendar-connect')>Connect Google</Pressable>
</FooterActions>
<MeloLine mt-5 mb-8 text=meloCalendarLine(tightestSpare,isEmpty) mood=meloCalendarMood(...)/>
</ScrollView>

AgendaView: stack gap-4; per group: View(ref) rounded2xl p-4 hairline, bg=accent-soft if tightest else surface, opacity.55 if past; header row(formatDayHeader + 'past' italic if past | '£n left after' if spare); EventRow[] gap-2; SeeOnRoute if !past. useEffect scrollTo measured y on jumpPulse → jumpDate??tightestDate.

WeekView: offset(weeks). Header(‹ monthLabel ›). SpareTrend card: 'What's left this week' + 'low £·high £', Svg viewBox 0 0 100 22 polyline accent sw1.2 non-scaling + tightest circle r1.6. 7-col strip: per day col rounded-xl (accent-soft tightest/inset today/none), opacity.55 past, aria=describeDay; weekday initial; day# (accent+medium if tightest); ≤4 KIND_DOT dots h-1.5. Stacked day-blocks (days w/ events): card as agenda, EventRow compact, SeeOnRoute if !past. useEffect sets offset to week of target.

MonthView: offset(months)+selected. Header(‹ display16 monthLabel ›). Weekday M T W T F S S grid7. Grid7: leading blank h-12; each day Pressable h-12 rounded-xl col center: selected bg=ink text=paper / tightest accent-soft / today inset / else hover; opacity.45 if past&!selected; aria=describeDay, aria-pressed=selected; day# (accent+medium if tightest unless selected); ▲/▼ tick (positive/negative, paper/70 if selected) by netForDay; ≤3 KIND_DOT dots. Sparkline(if>1): 'Spare across the month'+'low £n', Svg viewBox 0 0 100 18 polyline accent sw1. Selected panel: surface hairline rounded2xl p-4, formatDayHeader(selected); no events → 'Nothing moves your money on this day.' italic else EventRow[]; SeeOnRoute if selected>=today. useEffect sets offset+selected to target.

EventRow(e, compact?): row gap-2.5; leading dot mt-1.5 KIND_DOT[kind] + sr-only KIND_LABEL; body: title(truncate, + 'you added this' badge if manual) + amount(font-display tabular; positive if kind==='in' else ink); !compact: note(11 muted), recurring(↻ Repeats monthly/yearly); actions: source==='sub'&&subName → SubRenewalActions; else manual → Move(−1d/+1d updateCalendarEvent) + Remove(removeCalendarEvent).

SubRenewalActions(name): row wrap — Pause this(togglePaused(name,true)); Move; −3d/−1d/+1d/+3d(nudgeSub(name,d); focus/hover→preview); Reset(resetSubOverrides) if delta≠0. Preview(italic 10.5 muted) from previewSubNudge(...startingSpare:720); persistent caption(italic 10.5 accent) 'Nudged ±nd from its usual day' when set & not hovering. RN: hover→onPressIn/Out or long-press.

SeeOnRoute(date): Pressable mt-3 w-full 11 upper muted, aria 'See {formatDayProse(date)} on your money path' → setRouteFocusDate(date); nav.go('today'). Row: 'See this day on your money path' + accent '→'.

EmptyState(missing\*): surface hairline rounded2xl p-6 center; display italic 15 quoted head; 12 muted line. head/line = first missing of payday>bills>pots else default.

## enginesNeeded

- calendar-events engine (src/lib/calendar-events.ts): deriveCalendarEvents({subs,subPaused,subOverrides,onboarding,manualEvents,pots,now})→DerivedEvent[]; groupByDay; computeSpareAndTightest(groups,720)→{spareByDay,tightestDate,tightestSpare}; formatDayHeader; formatDayProse; previewSubNudge({...startingSpare:720})
- RN ship: fed by Money path engine + Bills + Subscription detector + Pot engine (RN_PORT 'needs a real engine'). RECURRING_BILLS and startingSpare 720 are SYNTHETIC stand-ins — RN must source 720 from the engine, not a literal
- Zustand store (src/lib/store.ts) actions in writes; RN = app store + versioned schema migration (RN_PORT store-migration note)
- DerivedEvent: { id, date(ISO), kind(in|out|review|deadline|manual), source(payday|bill|sub|deadline|review|manual|pot), title, note?, amount?(signed £), recurring?(monthly|yearly), subName?, manual? }
- MeloLine/Melo (kit): react-native-svg + reanimated breathe, 5 SVG moods
- Hydration gate is WEB SSR (Cloudflare UTC vs client TZ). RN has no SSR — set today at mount; keep null-guard only for the calm skeleton aesthetic, do not port the SSR rationale

## fidelityRisks

- Two SVG charts (week 0 0 100 22, month 0 0 100 18) use preserveAspectRatio='none' + vectorEffect='non-scaling-stroke' — react-native-svg supports neither; compute points against onLayout width/height and use fixed strokeWidth
- Hover-driven nudge preview (onMouseEnter/onFocus/onBlur) has no touch analog — redesign as onPressIn/onPressOut or long-press, else preview never shows on device
- scrollIntoView smooth block:center → RN measureLayout/onLayout + ScrollView.scrollTo(y, animated); agenda jump and focus-date bridge break silently if unwired
- today===null skeleton is an SSR artifact — porting literally adds a needless flash; drop it (no SSR) or keep purely as empty-frame aesthetic; never reproduce the SSR/UTC comment as a real RN constraint
- Strings inline + NOT in COPY_DECK.md — high drift/banned-word risk; add calendar.\* block first; keep parameterization (no concat); preserve '−' (U+2212) in amountStr & nudge labels, not ASCII '-'
- amountStr uses '−'(U+2212) for negatives, '+' for positives, '£' + toFixed(0|2); EventRow 'in' amount positive-coloured, else ink; preserve sign glyph + tabular-nums
- Mood mapping: meloCalendarMood calm|soft|alert ≠ Melo calm|curious|cheer|concern|celebrate — map soft→curious, alert→concern deliberately; Calendar not in MELO_MOODS, document choice
- Monday-start week math: (getDay()+6)%7 for weekStart and month leading blanks — keep Monday-start, not locale Sunday
- Past-day dimming differs per view (agenda/week .55, month .45 only when !selected) — don't unify
- Legend omits the manual/'You added this' dot (4 of 5 KIND_DOT) — intentional, don't add a 5th
- All £ chips clamp Math.max(0, Math.round()) — never show negative spare even when tightestSpare<=0 (which still drives the alert Melo band); keep clamp + band separation
- Three equal-width footer CTAs (grid3) with long labels at h-48 — text wraps/overflows on narrow RN; allow multi-line or smaller type, don't truncate copy
- describeDay() a11y sentence — port to accessibilityLabel on week-strip cells and month-grid buttons (colour alone insufficient) + accessibilityState selected on month
- View switch must NOT remount/recompute (STATES: 'switching never reloads data') — keep events/groups/spare memoised above the view branch, swap only the presentational subview

## docBlock

/\*\*

- @rn-screen CalendarScreen
- @rn-stack More > Calendar
- @purpose The time view of your money — the explanation layer for the Route.
-               Three planner views (Month · Week · Agenda) over the same data.
- @reads subs, subPaused, onboarding, calendarEvents
- @writes calendarEvents (via SheetAddEvent / inline remove)
- @opens-sheet route-detail · add-event · calendar-export · calendar-connect
- @copy FROZEN
- @tokens --paper --accent --positive --negative --caution --hairline --accent-soft
- @motion slide-in-r · scale-in for tightest-day banner · soft view crossfade
-
- @rn-future Business calendar lives alongside Personal — invoices, VAT,
-               reconciliation, client commitments. Built in RN.
  \*/

## rnPrimitiveMap

- root div overflow-y-auto no-scrollbar → ScrollView showsVerticalScrollIndicator={false} (Animated.ScrollView for slide-in-r)
- button → Pressable + expo-haptics selectionAsync (the press utility)
- role=tablist/tab + aria-selected → accessibilityRole tablist/tab + accessibilityState selected
- aria-label / sr-only → accessibilityLabel; span.sr-only → accessibilityLabel on parent or visually-hidden Text
- aria-pressed (month day) → accessibilityState selected
- svg polyline/circle → react-native-svg Svg/Polyline/Circle; compute points from onLayout width (no preserveAspectRatio/non-scaling-stroke)
- var(--x) → theme object + useTheme()/makeStyles; KIND_DOT/KIND_LABEL stay JS lookups
- tabular → Text style fontVariant ['tabular-nums']
- font-display Fraunces → embedded Fraunces family; italic via fontStyle
- hairline border → StyleSheet.hairlineWidth with --hairline
- transition-opacity/colors → static styles or reanimated withTiming; reduced-motion = final state
- hover/focus on nudge buttons → onPressIn/onPressOut or long-press (no hover on touch)
- scrollIntoView smooth → refs + measureLayout + ScrollView.scrollTo({y, animated:true})
- nav.back/nav.go('today')/nav.openSheet(id) → @react-navigation goBack()/navigate('Today') + @gorhom/bottom-sheet present(id)
- grid grid-cols-N gap → flexDirection row + flexWrap/percentage widths or grid helper
- capitalize/uppercase/tracking → textTransform + letterSpacing
- scale-in/slide-in-r → reanimated withTiming(translateX 28→0 360ms)/(scale .97→1 320ms)
- MeloLine/Melo → kit RN component (react-native-svg + reanimated breathe), 5 SVG moods

## stateBranches

- loading/hydration: today===null → calm skeleton (header + title + empty flex-1 surface-hairline rounded-2xl card, NO spare £). WEB-ONLY (SSR/UTC); RN may set today at mount and skip
- empty: events.length===0 → EmptyState with specific head/line for first missing lever (payday>bills>pots else generic). Tightest pill hidden; Melo = empty band ('Nothing pulling...', mood soft). Footer + legend still render
- populated: ≥1 derived event → tightest pill (if tightestDate) + selected view (default Agenda). Only real 'done' state; switching views never reloads (STATES.md)
- error: n/a — STATES.md marks Calendar error not-applicable (derived locally, nothing to fail)
- offline: same as populated — local-first, no network, no sync language; no separate branch
- within-view empties: Week/Month skip day-blocks for days w/o events; Month selected-day shows 'Nothing moves your money on this day.'; past days dimmed, no SeeOnRoute
