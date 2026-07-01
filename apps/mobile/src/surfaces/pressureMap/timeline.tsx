// Timeline — a human record of what you added and what you left (Quiet Paper Luxury).
//
// Faithful port of the web ScreenTimeline (folio-melo) onto RN primitives: a dot-timeline audit
// log, newest first, with a paper-haloed dot per entry sitting over a single hairline rail. The
// list is driven by the real timeline events from the canonical engine — never a static sample —
// with a calm empty state when there is nothing recorded yet.
//
// Verb → colour (from the web source):
//   • confirmed ("Added" / a posted fact)        → positive green  (t.positive)
//   • attention ("Paused" / needs a check)        → caution gold    (t.caution)
//   • estimated ("Edited" / an expectation/change)→ accent terracotta (t.calm)
//   • muted     ("Left for later" / "Ignored")    → muted ink       (t.muted)
// The web colours per literal verb string; the RN events carry a `tone` (the engine's distilled
// equivalent of those verbs), so we map tone → the same four colours rather than inventing verbs.

import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import {
  Body,
  gap,
  Headline,
  type Palette,
  PressureScreen,
  QuietLink,
  Surface,
  useTheme,
} from './kit';
import { Kicker, MeloLine, ScreenHeader } from './secondaryKit';
import { cleanTimelineNote, presentableTimelineEvents } from './timelinePresentation';
import type { LocalTimelineModel, LocalTimelineTone } from '../../local/localTimelineAdapter';

function dotColor(tone: LocalTimelineTone, t: Palette): string {
  // Added / posted fact — positive green.
  if (tone === 'confirmed') return t.positive;
  // Paused / needs a check — caution gold (data mark only).
  if (tone === 'attention') return t.caution;
  // Edited / a change or expectation — accent terracotta.
  if (tone === 'estimated') return t.calm;
  // Left for later / Ignored — muted.
  return t.muted;
}

export function TimelineScreen({
  onBack,
  onOpenCalendar,
  timeline,
}: {
  onBack: () => void;
  onOpenCalendar: () => void;
  // Accepted for prop-contract parity with the container.
  onOpenSources: () => void;
  timeline: LocalTimelineModel;
}) {
  const t = useTheme();
  const s = useMemo(() => makeStyles(t), [t]);

  // Show what the user did — not auto-generated balance bookkeeping (which on a fresh ledger would
  // render a synthetic "history" instead of a calm empty state).
  const events = presentableTimelineEvents(timeline.events);

  return (
    <PressureScreen>
      <ScreenHeader label="Timeline" onBack={onBack} />

      <View style={layout.intro}>
        <Headline lead="Everything you've " accent="added" tail=" or skipped." />
        <Kicker>Newest first. Nothing is hidden.</Kicker>
      </View>

      {events.length === 0 ? (
        <Surface>
          <Body>
            Nothing here yet. What you add — and what you leave for later — shows up here, newest
            first.
          </Body>
        </Surface>
      ) : (
        <View style={layout.rail}>
          <View style={s.railLine} />
          {events.map((event, index) => {
            const note = cleanTimelineNote(event.detail);
            return (
              <View key={`${event.title}-${index}`} style={layout.entry}>
                {/* The dot wears a 3px paper halo (the web's `box-shadow: 0 0 0 3px var(--paper)`),
                    drawn here as a ring of the canvas colour so the dot punches cleanly over the
                    rail rather than touching it. */}
                <View style={[layout.dotHalo, s.dotHalo]}>
                  <View style={[layout.dot, { backgroundColor: dotColor(event.tone, t) }]} />
                </View>
                <View style={layout.entryBody}>
                  <Text style={s.when}>{event.day}</Text>
                  <View style={layout.actionRow}>
                    <Text style={layout.actionText}>
                      <Text style={s.verb}>{event.kindLabel} </Text>
                      <Text style={s.what}>{event.title}</Text>
                    </Text>
                    {event.amount ? <Text style={s.amount}>{event.amount}</Text> : null}
                  </View>
                  {note ? (
                    <Text numberOfLines={2} style={s.note}>
                      {note}
                    </Text>
                  ) : null}
                </View>
              </View>
            );
          })}
        </View>
      )}

      <QuietLink
        label="See the dates that matter"
        accessibilityHint="Opens Calendar."
        onPress={onOpenCalendar}
      />

      <MeloLine tone="soft" text="You can undo any of these. Nothing is locked." />
    </PressureScreen>
  );
}

// The rail line sits at the centre of the dot. Web: dot is 9px wide at left 3px (centre 7.5px),
// rail at left 7px. Here the dot is 9px inside a 3px halo, so the halo's left edge is the rail.
const HALO = 3;
const DOT = 9;
const RAIL_CENTER = HALO + DOT / 2; // 7.5 — centre of the dot/halo, where the rail aligns

// Layout-only styles — no colour, so they never change with the theme.
const layout = StyleSheet.create({
  // The web pairs the headline with a tight 8px gap to the sub-line (mt-2) inside a block that the
  // screen's own section rhythm separates from the rail.
  intro: {
    gap: gap.xs,
  },

  rail: {
    position: 'relative',
    gap: 20, // web `space-y-5`
  },
  entry: {
    flexDirection: 'row',
  },
  // The 3px paper halo around the dot (web `box-shadow: 0 0 0 3px var(--paper)`). Layout here;
  // the canvas-coloured ring fill lives in makeStyles so it follows the theme.
  dotHalo: {
    position: 'absolute',
    left: 0,
    top: 6, // web dot top-[6px]
    width: DOT + HALO * 2,
    height: DOT + HALO * 2,
    borderRadius: (DOT + HALO * 2) / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    width: DOT,
    height: DOT,
    borderRadius: DOT / 2,
  },
  entryBody: {
    flex: 1,
    paddingLeft: 28, // web pl-7
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginTop: 2, // web mt-0.5
    gap: gap.sm,
  },
  actionText: { flex: 1, fontSize: 14, lineHeight: 20 }, // web text-[14px]
});

// Colour-bearing styles — rebuilt whenever the active palette changes.
function makeStyles(t: Palette) {
  return StyleSheet.create({
    // A single hairline rail behind the dots (web: absolute left-[7px], inset 8px top/bottom).
    railLine: {
      position: 'absolute',
      left: RAIL_CENTER - StyleSheet.hairlineWidth / 2,
      top: 8,
      bottom: 8,
      width: StyleSheet.hairlineWidth,
      backgroundColor: t.hairline,
    },
    // The warm canvas ring so the dot reads as floating on the rail, not welded to it.
    dotHalo: {
      backgroundColor: t.canvas,
    },
    when: {
      color: t.muted,
      fontSize: 11, // web 10.5px, rounded for RN
      fontWeight: '600',
      letterSpacing: 1.2, // web tracking-[0.14em]
      textTransform: 'uppercase',
    },
    verb: { color: t.muted },
    what: { color: t.ink, fontWeight: '500' }, // web font-medium
    amount: {
      color: t.muted,
      fontSize: 12,
      fontVariant: ['tabular-nums'],
    },
    // Body copy stays in the system grotesque (Inter) — the serif italic is reserved for the one
    // headline accent word and Melo's voice line, never multi-line notes.
    note: {
      color: t.muted,
      fontSize: 12, // web text-[12px]
      lineHeight: 17,
      marginTop: 2, // web mt-0.5
    },
  });
}
