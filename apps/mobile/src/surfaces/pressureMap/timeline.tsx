// Timeline — a human record of what you added and what you left (Quiet Paper Luxury).
//
// Faithful port of the web ScreenTimeline (folio-melo) onto RN primitives: a dot-timeline audit
// log, newest first, with a paper-haloed dot per entry sitting over a single hairline rail. The
// list is driven by the real timeline events from the canonical engine — never a static sample —
// with a calm empty state when there is nothing recorded yet.
//
// Verb → colour (from the web source):
//   • confirmed ("Added" / a posted fact)        → positive green  (paper.positive)
//   • attention ("Paused" / needs a check)        → caution gold    (paper.caution)
//   • estimated ("Edited" / an expectation/change)→ accent terracotta (paper.calm)
//   • muted     ("Left for later" / "Ignored")    → muted ink       (paper.muted)
// The web colours per literal verb string; the RN events carry a `tone` (the engine's distilled
// equivalent of those verbs), so we map tone → the same four colours rather than inventing verbs.

import { StyleSheet, Text, View } from 'react-native';

import { Body, gap, Headline, paper, PressureScreen, QuietLink, Surface } from './kit';
import { Kicker, MeloLine, ScreenHeader } from './secondaryKit';
import { cleanTimelineNote, presentableTimelineEvents } from './timelinePresentation';
import type { LocalTimelineModel, LocalTimelineTone } from '../../local/localTimelineAdapter';

function dotColor(tone: LocalTimelineTone): string {
  // Added / posted fact — positive green.
  if (tone === 'confirmed') return paper.positive;
  // Paused / needs a check — caution gold (data mark only).
  if (tone === 'attention') return paper.caution;
  // Edited / a change or expectation — accent terracotta.
  if (tone === 'estimated') return paper.calm;
  // Left for later / Ignored — muted.
  return paper.muted;
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
  // Show what the user did — not auto-generated balance bookkeeping (which on a fresh ledger would
  // render a synthetic "history" instead of a calm empty state).
  const events = presentableTimelineEvents(timeline.events);

  return (
    <PressureScreen>
      <ScreenHeader label="Timeline" onBack={onBack} />

      <View style={styles.intro}>
        <Headline lead="A record of " accent="your" tail=" hand." />
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
        <View style={styles.rail}>
          <View style={styles.railLine} />
          {events.map((event, index) => {
            const note = cleanTimelineNote(event.detail);
            return (
              <View key={`${event.title}-${index}`} style={styles.entry}>
                {/* The dot wears a 3px paper halo (the web's `box-shadow: 0 0 0 3px var(--paper)`),
                    drawn here as a ring of the canvas colour so the dot punches cleanly over the
                    rail rather than touching it. */}
                <View style={styles.dotHalo}>
                  <View style={[styles.dot, { backgroundColor: dotColor(event.tone) }]} />
                </View>
                <View style={styles.entryBody}>
                  <Text style={styles.when}>{event.day}</Text>
                  <View style={styles.actionRow}>
                    <Text style={styles.actionText}>
                      <Text style={styles.verb}>{event.kindLabel} </Text>
                      <Text style={styles.what}>{event.title}</Text>
                    </Text>
                    {event.amount ? <Text style={styles.amount}>{event.amount}</Text> : null}
                  </View>
                  {note ? (
                    <Text numberOfLines={2} style={styles.note}>
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

const styles = StyleSheet.create({
  // The web pairs the headline with a tight 8px gap to the sub-line (mt-2) inside a block that the
  // screen's own section rhythm separates from the rail.
  intro: {
    gap: gap.xs,
  },

  rail: {
    position: 'relative',
    gap: 20, // web `space-y-5`
  },
  // A single hairline rail behind the dots (web: absolute left-[7px], inset 8px top/bottom).
  railLine: {
    position: 'absolute',
    left: RAIL_CENTER - StyleSheet.hairlineWidth / 2,
    top: 8,
    bottom: 8,
    width: StyleSheet.hairlineWidth,
    backgroundColor: paper.hairline,
  },
  entry: {
    flexDirection: 'row',
  },
  // The 3px paper halo around the dot — a ring of the warm canvas so the dot reads as floating on
  // the rail, not welded to it (web `box-shadow: 0 0 0 3px var(--paper)`).
  dotHalo: {
    position: 'absolute',
    left: 0,
    top: 6, // web dot top-[6px]
    width: DOT + HALO * 2,
    height: DOT + HALO * 2,
    borderRadius: (DOT + HALO * 2) / 2,
    backgroundColor: paper.canvas,
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
  when: {
    color: paper.muted,
    fontSize: 11, // web 10.5px, rounded for RN
    fontWeight: '600',
    letterSpacing: 1.2, // web tracking-[0.14em]
    textTransform: 'uppercase',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginTop: 2, // web mt-0.5
    gap: gap.sm,
  },
  actionText: { flex: 1, fontSize: 14, lineHeight: 20 }, // web text-[14px]
  verb: { color: paper.muted },
  what: { color: paper.ink, fontWeight: '500' }, // web font-medium
  amount: {
    color: paper.muted,
    fontSize: 12,
    fontVariant: ['tabular-nums'],
  },
  // Body copy stays in the system grotesque (Inter) — the serif italic is reserved for the one
  // headline accent word and Melo's voice line, never multi-line notes.
  note: {
    color: paper.muted,
    fontSize: 12, // web text-[12px]
    lineHeight: 17,
    marginTop: 2, // web mt-0.5
  },
});
