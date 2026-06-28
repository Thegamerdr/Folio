// Payday Ritual — close the cycle in four calm steps (Quiet Paper Luxury).
//
// Faithful RN port of the web ScreenPaydayRitual (src/components/folio/screens/
// ScreenPaydayRitual.tsx). A four-step "close the cycle" flow that reuses the rough-first-answer
// wizard pattern: a progress rail, an editorial eyebrow + Fraunces headline carrying ONE terracotta
// accent word, a stat card, a quiet Melo line, and a single lifted PrimaryAction — with a quiet
// "Save and finish later" beneath it.
//
//   1. Review the cycle just gone (cash spare it held).
//   2. Move a little into pots (the set-aside).
//   3. Set next cycle's tight point (where the squeeze lands next).
//   4. Leave one line for next-you (the note), then finish.
//
// Presentation ONLY. It never talks to the engine. The container passes the engine view-models
// (insights / pots) plus the on* handler callbacks; on finish the screen converts its wizard state
// to MINOR units and calls onCloseCycle(CreateCycleRecordInput), then onFinished() (the container
// routes to Today and opens Share). Money is read through formatMinorAmount so there is no
// formatting drift with the rest of the app.

import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { formatMinorAmount, type CreateCycleRecordInput } from '../../local/localLedger';
import type { LocalInsightsModel } from '../../local/localInsightsAdapter';
import type { LocalPotsModel } from '../../local/localPotsAdapter';
import {
  Body,
  Eyebrow,
  Headline,
  MoneyPad,
  Muted,
  PressureScreen,
  PrimaryAction,
  QuietLink,
  Surface,
  gap,
  paper,
  serif,
  type VerdictTone,
} from './kit';
import { MeloLine } from './secondaryKit';
import { Sheet } from './Sheet';

// The web hardcodes a note string; the RN port lets next-you actually write the line. This is the
// suggested text, shown as the placeholder so the screen reads identically until the user types.
const NOTE_SUGGESTION = "Don't move Octopus this time. Hold the line on takeaway.";

// The stat card's tone maps to the kit verdict colours: a held cycle and a saved note read as the
// calm-green positive, the set-aside as neutral ink, the next tight point as the terracotta accent.
type StatTone = 'positive' | 'ink' | 'accent';

function statColor(tone: StatTone): string {
  if (tone === 'positive') return paper.positiveInk;
  if (tone === 'accent') return paper.calm;
  return paper.ink;
}

// The accent word on each step's headline takes its colour from the matching verdict tone, so the
// editorial accent stays meaningful (green when you held, accent for the squeeze) rather than always
// terracotta. Undefined = the brand terracotta accent.
function accentToneFor(tone: StatTone): VerdictTone | undefined {
  if (tone === 'positive') return 'positive';
  return undefined;
}

function digits(value: string): number {
  const clean = value.replace(/[^0-9]/g, '');
  return clean.length === 0 ? 0 : Number(clean);
}

type StepCopy = Readonly<{
  eyebrow: string;
  lead: string;
  accent: string;
  tail: string;
  body: string;
  statLabel: string;
  statValue: string;
  statTone: StatTone;
  melo: string;
  cta: string;
}>;

export function PaydayRitualScreen({
  insights,
  pots,
  cycleLabel,
  onCloseCycle,
  onFinished,
  onBack,
  reduceMotion,
}: {
  // The closed-cycle KPIs the engine already computed. Drives the spare it held and the average
  // tight point, so the ritual reflects this device's real history (never a fixture).
  insights: LocalInsightsModel;
  // The pots model — its current sum is the honest "set aside" figure for step two.
  pots: LocalPotsModel;
  // The label this closed cycle is recorded under (e.g. the current month). The container owns the
  // calendar, so it passes the label rather than the screen deriving a date.
  cycleLabel: string;
  // Records the closed cycle. MINOR units. The screen assembles this from its own wizard state.
  onCloseCycle: (input: CreateCycleRecordInput) => void;
  // After the cycle is recorded: the container routes to Today and opens the Share sheet.
  onFinished: () => void;
  // Quiet back / "finish later" — leaves the ritual without recording anything.
  onBack: () => void;
  reduceMotion?: boolean | undefined;
}) {
  const [step, setStep] = useState(0);

  // The spare the cycle held and the set-aside both come straight from the engine view-models, so
  // the ritual never invents money. Step three (next tight point) and step four (the note) are the
  // two things next-you decides here, so they live in wizard state.
  const spareMinor = insights.kpis.avgSetAsideMinor > 0 ? insights.kpis.savedAcrossCyclesMinor : 0;
  const heldSpareMinor = insights.kpis.savedAcrossCyclesMinor;
  const setAsideMinor = pots.sumSavedMinor;
  const avgTightMinor = insights.kpis.avgTightPointMinor;

  // Next tight point — the one number next-you sets. Seeded from the engine's average tight point so
  // the keypad opens on a sensible figure (in whole pounds, matching the MoneyPad), editable on tap.
  const [tightSheetOpen, setTightSheetOpen] = useState(false);
  const [nextTightPounds, setNextTightPounds] = useState(() =>
    String(Math.round(avgTightMinor / 100)),
  );
  const nextTightMinor = digits(nextTightPounds) * 100;

  // The note next-you leaves. Empty = the suggested line is used (shown as placeholder).
  const [noteSheetOpen, setNoteSheetOpen] = useState(false);
  const [note, setNote] = useState('');
  const noteForRecord = note.trim().length > 0 ? note.trim() : NOTE_SUGGESTION;
  const noteSaved = note.trim().length > 0;

  const steps: readonly StepCopy[] = useMemo(
    () => [
      {
        eyebrow: 'Step one',
        lead: 'Look at the ',
        accent: 'cycle',
        tail: ' just gone.',
        body: 'Bills cleared. You held the path to payday and kept a little back.',
        statLabel: 'Cycle spare',
        statValue: formatMinorAmount(heldSpareMinor),
        statTone: 'positive',
        melo: 'You held the path. Quietly well done.',
        cta: 'Pay yourself first',
      },
      {
        eyebrow: 'Step two',
        lead: 'Move ',
        accent: 'a little',
        tail: ' into pots.',
        body: 'This is what you have tucked into pots so far. You can change any of these later.',
        statLabel: 'Set aside',
        statValue: formatMinorAmount(setAsideMinor),
        statTone: 'ink',
        melo: 'Small, steady. Your future self will thank you.',
        cta: 'Set the tight point',
      },
      {
        eyebrow: 'Step three',
        lead: "Where's the ",
        accent: 'squeeze',
        tail: ' next cycle?',
        body: 'Set where the lowest point lands next time. Plan around it before it arrives.',
        statLabel: 'Next tight point',
        statValue: formatMinorAmount(nextTightMinor),
        statTone: 'accent',
        melo: 'Knowing in advance is half the work.',
        cta: 'Leave a note for next-you',
      },
      {
        eyebrow: 'Step four',
        lead: 'One ',
        accent: 'line',
        tail: ' for next-you.',
        body: noteSaved ? `“${noteForRecord}”` : `“${NOTE_SUGGESTION}”`,
        statLabel: 'Note',
        statValue: noteSaved ? 'Saved' : 'Suggested',
        statTone: 'positive',
        melo: 'Done. The cycle is closed.',
        cta: 'Finish the ritual',
      },
    ],
    [heldSpareMinor, setAsideMinor, nextTightMinor, noteForRecord, noteSaved],
  );

  const current = steps[step];
  const isLast = step === steps.length - 1;
  if (current === undefined) {
    return null;
  }

  const advance = () => {
    if (!isLast) {
      // Step two's CTA opens the tight-point keypad; step three's opens the note. The web advances
      // the same step on its single button — here the sheet is the way next-you sets each value, and
      // closing it advances. Tapping the CTA when the value is already set just advances.
      setStep((s) => s + 1);
      return;
    }
    // Finish: assemble the closed-cycle record in MINOR units and hand it to the container, then let
    // the container route to Today + open Share.
    const input: CreateCycleRecordInput = {
      label: cycleLabel,
      spareMinor: heldSpareMinor,
      tightPointMinor: nextTightMinor,
      setAsideMinor,
      note: noteForRecord,
    };
    onCloseCycle(input);
    onFinished();
  };

  return (
    <PressureScreen style={styles.screen}>
      <View style={styles.head}>
        <Pressable
          accessibilityHint="Leaves the ritual without closing the cycle."
          accessibilityLabel="Back"
          accessibilityRole="button"
          hitSlop={12}
          onPress={onBack}
        >
          <Text style={styles.backText}>‹</Text>
        </Pressable>
        <ProgressRail step={step} total={steps.length} />
        <View style={styles.headSpacer} />
      </View>

      <View style={styles.intro}>
        <Eyebrow>{current.eyebrow}</Eyebrow>
        <Headline
          lead={current.lead}
          accent={current.accent}
          tail={current.tail}
          accentTone={accentToneFor(current.statTone)}
          style={styles.headline}
        />
        <Body style={styles.body}>{current.body}</Body>
      </View>

      <Surface style={styles.statCard}>
        <Text style={styles.statLabel}>{current.statLabel}</Text>
        <Text style={[styles.statValue, { color: statColor(current.statTone) }]}>
          {current.statValue}
        </Text>
      </Surface>

      <MeloLine tone="soft" text={current.melo} />

      <View style={styles.footer}>
        <PrimaryAction
          accessibilityHint={
            isLast ? 'Records the closed cycle and shows it on Today.' : undefined
          }
          label={current.cta}
          onPress={advance}
        />
        <QuietLink
          accessibilityHint="Saves nothing and leaves the ritual."
          label="Save and finish later"
          onPress={onBack}
        />
      </View>

      <Sheet onClose={() => setTightSheetOpen(false)} reduceMotion={reduceMotion} visible={tightSheetOpen}>
        <KeypadSheet
          eyebrow="Step three"
          title="Where's the squeeze next cycle?"
          helper="The lowest your money is likely to dip next time. Roughly is fine."
          value={nextTightPounds}
          onChange={setNextTightPounds}
          onDone={() => setTightSheetOpen(false)}
        />
      </Sheet>

      <Sheet onClose={() => setNoteSheetOpen(false)} reduceMotion={reduceMotion} visible={noteSheetOpen}>
        <NoteSheet value={note} onChange={setNote} onDone={() => setNoteSheetOpen(false)} />
      </Sheet>
    </PressureScreen>
  );
}

// The progress rail — the web's row of pills: the active step is a wide terracotta bar, completed
// steps a shorter ink bar, upcoming steps a short hairline bar.
function ProgressRail({ step, total }: { step: number; total: number }) {
  return (
    <View accessibilityLabel={`Step ${step + 1} of ${total}`} style={styles.rail}>
      {Array.from({ length: total }, (_, i) => (
        <View
          key={i}
          style={[
            styles.railPill,
            i === step
              ? styles.railPillActive
              : i < step
                ? styles.railPillDone
                : styles.railPillUpcoming,
          ]}
        />
      ))}
    </View>
  );
}

// A calm keypad sheet for setting the next tight point — composes the kit MoneyPad inside the shared
// Sheet primitive, so it matches the rough-first-answer amount step.
function KeypadSheet({
  eyebrow,
  title,
  helper,
  value,
  onChange,
  onDone,
}: {
  eyebrow: string;
  title: string;
  helper: string;
  value: string;
  onChange: (next: string) => void;
  onDone: () => void;
}) {
  const display = formatMinorAmount(digits(value) * 100);
  return (
    <View style={styles.sheetBody}>
      <Eyebrow>{eyebrow}</Eyebrow>
      <Text style={styles.sheetTitle}>{title}</Text>
      <Muted style={styles.sheetHelper}>{helper}</Muted>
      <Text style={styles.sheetAmount}>{display}</Text>
      <MoneyPad onChange={onChange} value={value} />
      <PrimaryAction label="Set it" onPress={onDone} />
    </View>
  );
}

// The note sheet — one line for next-you. Faithful to the web's single-line note; an empty line
// falls back to the suggested text when the cycle is recorded.
function NoteSheet({
  value,
  onChange,
  onDone,
}: {
  value: string;
  onChange: (next: string) => void;
  onDone: () => void;
}) {
  return (
    <View style={styles.sheetBody}>
      <Eyebrow>Step four</Eyebrow>
      <Text style={styles.sheetTitle}>One line for next-you.</Text>
      <Muted style={styles.sheetHelper}>
        A short reminder of what held the line this time. Leave it blank to use the suggestion.
      </Muted>
      <View style={styles.noteField}>
        <Text style={styles.noteText}>
          {value.trim().length > 0 ? value : NOTE_SUGGESTION}
        </Text>
      </View>
      <PrimaryAction label="Save the note" onPress={onDone} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { gap: gap.lg },

  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 24,
  },
  backText: { color: paper.muted, fontSize: 24, lineHeight: 24, fontWeight: '400' },
  headSpacer: { width: 20 },

  rail: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  railPill: { height: 4, borderRadius: 2 },
  railPillActive: { width: 28, backgroundColor: paper.calm },
  railPillDone: { width: 20, backgroundColor: paper.secondary },
  railPillUpcoming: { width: 20, backgroundColor: paper.hairline },

  intro: { gap: gap.sm },
  headline: { fontSize: 32, lineHeight: 38, marginTop: 2 },
  body: { color: paper.secondary, fontSize: 14, lineHeight: 22, marginTop: gap.xs, maxWidth: 330 },

  statCard: { gap: 4 },
  statLabel: {
    color: paper.muted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  statValue: {
    fontFamily: serif.display,
    fontSize: 44,
    lineHeight: 50,
    letterSpacing: -1,
    fontVariant: ['tabular-nums'],
  },

  footer: { gap: gap.xs, marginTop: gap.xs },

  sheetBody: { gap: gap.sm },
  sheetTitle: {
    color: paper.ink,
    fontFamily: serif.display,
    fontSize: 24,
    lineHeight: 29,
    letterSpacing: -0.3,
    marginTop: 2,
  },
  sheetHelper: { fontSize: 14, maxWidth: 330 },
  sheetAmount: {
    color: paper.ink,
    fontSize: 44,
    fontWeight: '800',
    letterSpacing: -1.4,
    fontVariant: ['tabular-nums'],
    textAlign: 'center',
    paddingVertical: gap.xs,
  },

  noteField: {
    backgroundColor: paper.inset,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: paper.hairline,
    padding: gap.lg,
    marginTop: gap.xs,
  },
  noteText: {
    color: paper.ink,
    fontFamily: serif.displayItalic,
    fontSize: 16,
    lineHeight: 23,
  },
});
