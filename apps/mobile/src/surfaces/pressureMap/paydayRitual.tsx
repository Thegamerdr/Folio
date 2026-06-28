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
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

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
  elevation,
  gap,
  paper,
  pressed,
  serif,
  type VerdictTone,
} from './kit';
import { MeloLine } from './secondaryKit';
import { Sheet } from './Sheet';
import {
  NOTE_SUGGESTION,
  buildCycleRecordInput,
  poundsToMinor,
  resolveNote,
  statEditorForStep,
} from './paydayRitualLogic';

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
  const heldSpareMinor = insights.kpis.savedAcrossCyclesMinor;
  const setAsideMinor = pots.sumSavedMinor;
  const avgTightMinor = insights.kpis.avgTightPointMinor;

  // Next tight point — the one number next-you sets. Seeded from the engine's average tight point so
  // the keypad opens on a sensible figure (in whole pounds, matching the MoneyPad), editable on tap.
  const [tightSheetOpen, setTightSheetOpen] = useState(false);
  const [nextTightPounds, setNextTightPounds] = useState(() =>
    String(Math.round(avgTightMinor / 100)),
  );
  const nextTightMinor = poundsToMinor(nextTightPounds);

  // The note next-you leaves. Empty = the suggested line is used (shown as placeholder).
  const [noteSheetOpen, setNoteSheetOpen] = useState(false);
  const [note, setNote] = useState('');
  const noteForRecord = resolveNote(note);
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

  // Two of the four steps are decisions next-you makes: step three sets the next tight point, step
  // four leaves the note. On those steps the stat card is the thing being decided, so it becomes a
  // tappable affordance that opens the matching sheet (the keypad / the note line). Steps one and two
  // are read-only reflections of engine figures, so their card stays a plain, untappable surface.
  const statEditor = statEditorForStep(step);
  const onStatPress =
    statEditor === 'tight'
      ? () => setTightSheetOpen(true)
      : statEditor === 'note'
        ? () => setNoteSheetOpen(true)
        : undefined;
  const statHint =
    statEditor === 'tight'
      ? 'Tap to set the figure'
      : statEditor === 'note'
        ? 'Tap to write the line'
        : undefined;

  const advance = () => {
    if (!isLast) {
      // The CTA always moves to the next step. On the two decision steps (three: the next tight
      // point, four: the note) next-you sets the value by tapping the stat card, which opens the
      // matching sheet; the chosen value is held in wizard state and flows into the recorded cycle
      // below. Advancing without tapping keeps the seeded tight point / the suggested note.
      setStep((s) => s + 1);
      return;
    }
    // Finish: assemble the closed-cycle record in MINOR units and hand it to the container, then let
    // the container route to Today + open Share.
    onCloseCycle(
      buildCycleRecordInput({
        label: cycleLabel,
        heldSpareMinor,
        nextTightMinor,
        setAsideMinor,
        note,
      }),
    );
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

      {onStatPress ? (
        <Pressable
          accessibilityHint="Opens the entry so you can set it yourself."
          accessibilityLabel={`${current.statLabel}. ${statHint}.`}
          accessibilityRole="button"
          onPress={onStatPress}
          style={({ pressed: isPressed }) => [
            styles.statSurface,
            styles.statCard,
            isPressed ? pressed : undefined,
          ]}
        >
          <Text style={styles.statLabel}>{current.statLabel}</Text>
          <Text style={[styles.statValue, { color: statColor(current.statTone) }]}>
            {current.statValue}
          </Text>
          {statHint ? <Text style={styles.statHint}>{statHint}</Text> : null}
        </Pressable>
      ) : (
        <Surface style={styles.statCard}>
          <Text style={styles.statLabel}>{current.statLabel}</Text>
          <Text style={[styles.statValue, { color: statColor(current.statTone) }]}>
            {current.statValue}
          </Text>
        </Surface>
      )}

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
  const display = formatMinorAmount(poundsToMinor(value));
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

// The note sheet — a line for next-you. The field is editable: the suggested text shows as the
// placeholder, and an empty line falls back to it (resolveNote) when the cycle is recorded.
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
        <TextInput
          accessibilityLabel="A line for next-you"
          multiline
          onChangeText={onChange}
          placeholder={NOTE_SUGGESTION}
          placeholderTextColor={paper.muted}
          style={styles.noteText}
          value={value}
        />
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
  // The tappable variant of the stat card on the two decision steps: it matches the kit Surface
  // look (raised paper, soft lift) so the only visible difference is the quiet "tap to set" hint.
  statSurface: {
    backgroundColor: paper.surface,
    borderRadius: 20,
    padding: gap.xl,
    ...elevation.card,
  },
  statHint: {
    color: paper.calmStrong,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.2,
    marginTop: 2,
  },
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
